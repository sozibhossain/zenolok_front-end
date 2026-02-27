"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clock3,
  ImagePlus,
  Locate,
  Plus,
  Send,
  Share2,
  Trash2,
  UserPlus,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import type { DateRange } from "react-day-picker";

import {
  eventApi,
  eventTodoApi,
  jamApi,
  type EventData,
  type EventTodo,
  userApi,
} from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { BrickIcon } from "@/components/shared/brick-icon";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionLoading } from "@/components/shared/section-loading";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function mapParticipants(participants: EventData["participants"]) {
  return participants
    .map((participant) => (typeof participant === "string" ? null : participant))
    .filter((participant): participant is NonNullable<typeof participant> => Boolean(participant));
}

function getParticipantDisplayName(participant: { name?: string; username?: string; email?: string }) {
  return participant.name || participant.username || participant.email || "User";
}

export default function EventDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const id = params.id;

  const [newTodoText, setNewTodoText] = useState("");
  const [messageText, setMessageText] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [selectedDates, setSelectedDates] = useState<DateRange | undefined>(undefined);
  const [dateDialogOpen, setDateDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const eventQuery = useQuery({
    queryKey: queryKeys.event(id),
    queryFn: () => eventApi.getById(id),
    enabled: Boolean(id),
  });

  const eventTodosQuery = useQuery({
    queryKey: queryKeys.eventTodos(id),
    queryFn: () => eventTodoApi.getByEvent(id),
    enabled: Boolean(id),
  });

  const messagesQuery = useQuery({
    queryKey: queryKeys.jamMessages(id),
    queryFn: () => jamApi.getByEvent(id),
    enabled: Boolean(id),
  });

  const userSearchQuery = useQuery({
    queryKey: queryKeys.userSearch(userSearch),
    queryFn: () => userApi.searchUsers(userSearch),
    enabled: userSearch.length > 1,
  });

  const refreshEverything = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.event(id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.eventTodos(id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.events({ filter: "upcoming" }) });
    queryClient.invalidateQueries({ queryKey: queryKeys.events({ filter: "past" }) });
    queryClient.invalidateQueries({ queryKey: queryKeys.events({ filter: "all" }) });
    queryClient.invalidateQueries({ queryKey: queryKeys.jamMessages(id) });
  };

  const deleteEventMutation = useMutation({
    mutationFn: () => eventApi.delete(id),
    onSuccess: () => {
      toast.success("Event deleted");
      router.push("/events");
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message || "Failed to delete event"),
  });

  const updateEventMutation = useMutation({
    mutationFn: (payload: Partial<EventData>) => eventApi.update(id, payload),
    onSuccess: () => {
      toast.success("Event updated");
      refreshEverything();
    },
    onError: (error: Error) => toast.error(error.message || "Failed to update event"),
  });

  const addTodoMutation = useMutation({
    mutationFn: () => {
      if (!newTodoText.trim()) {
        throw new Error("Todo text is required");
      }

      return eventTodoApi.create({
        text: newTodoText,
        eventId: id,
      });
    },
    onSuccess: () => {
      setNewTodoText("");
      refreshEverything();
    },
    onError: (error: Error) => toast.error(error.message || "Failed to add todo"),
  });

  const updateTodoMutation = useMutation({
    mutationFn: ({ todoId, payload }: { todoId: string; payload: Partial<EventTodo> }) =>
      eventTodoApi.update(todoId, payload),
    onSuccess: refreshEverything,
    onError: (error: Error) => toast.error(error.message || "Failed to update todo"),
  });

  const deleteTodoMutation = useMutation({
    mutationFn: (todoId: string) => eventTodoApi.delete(todoId),
    onSuccess: refreshEverything,
    onError: (error: Error) => toast.error(error.message || "Failed to delete todo"),
  });

  const sendMessageMutation = useMutation({
    mutationFn: () => {
      if (!messageText.trim() && !selectedFile) {
        throw new Error("Write a message or attach a file");
      }

      const form = new FormData();
      form.append("eventId", id);
      if (messageText.trim()) {
        form.append("text", messageText.trim());
      }
      form.append("messageType", selectedFile ? "media" : "text");

      if (selectedFile) {
        form.append("file", selectedFile);
      }

      return jamApi.create(form);
    },
    onSuccess: () => {
      setMessageText("");
      setSelectedFile(null);
      refreshEverything();
    },
    onError: (error: Error) => toast.error(error.message || "Failed to send message"),
  });

  const event = eventQuery.data;
  const participants = useMemo(() => mapParticipants(event?.participants || []), [event?.participants]);

  const addParticipantMutation = useMutation({
    mutationFn: (userId: string) => {
      if (!event) {
        throw new Error("Event not loaded yet");
      }

      const currentIds = event.participants.map((participant) =>
        typeof participant === "string" ? participant : participant._id
      );

      if (currentIds.includes(userId)) {
        throw new Error("User already added");
      }

      return eventApi.update(id, {
        participants: [...currentIds, userId],
      });
    },
    onSuccess: () => {
      toast.success("Participant added");
      refreshEverything();
    },
    onError: (error: Error) => toast.error(error.message || "Failed to add participant"),
  });

  if (eventQuery.isLoading) {
    return <SectionLoading rows={6} />;
  }

  if (!event) {
    return <EmptyState title="Event not found" description="The event was removed or you don't have access." />;
  }

  const mediaMessages = (messagesQuery.data || []).filter((message) => message.mediaUrl);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-xl font-medium text-[#2E333B]">
          <ArrowLeft className="size-5" /> Back
        </button>
        <div className="flex items-center gap-2">
          <button className="text-[#FF3B30]" onClick={() => deleteEventMutation.mutate()}>
            <Trash2 className="size-5" />
          </button>
          <button className="text-[#0A84FF]" onClick={() => updateEventMutation.mutate({ title: event.title })}>
            <Check className="size-5" />
          </button>
        </div>
      </div>

      <section className="rounded-[28px] border border-[#E0E4EC] bg-[#F4F6FA] p-4 sm:p-6">
        <Card className="rounded-2xl bg-[#E8ECF3] p-4 shadow-none">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-4xl font-semibold text-[#3A3F49]">{event.title}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {event.brick ? (
                  <Badge variant="blue" style={{ backgroundColor: event.brick.color }}>
                    <BrickIcon name={event.brick.icon} className="size-3.5" /> {event.brick.name}
                  </Badge>
                ) : null}
              </div>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <button className="text-[#6F7789] hover:text-[#2E333B]">
                  <Share2 className="size-5" />
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl rounded-[26px]">
                <DialogHeader>
                  <DialogTitle>Share tasks with others.</DialogTitle>
                </DialogHeader>
                <Input
                  placeholder="Search by name..."
                  value={userSearch}
                  onChange={(event) => setUserSearch(event.target.value)}
                  className="h-12"
                />
                <div className="max-h-[320px] space-y-2 overflow-auto rounded-xl border border-[#DFE3EC] bg-[#F8FAFD] p-2">
                  {userSearchQuery.data?.map((user) => (
                    <div key={user._id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Avatar className="size-8">
                          <AvatarImage src={user.avatar?.url} />
                          <AvatarFallback>{getParticipantDisplayName(user).slice(0, 1)}</AvatarFallback>
                        </Avatar>
                        <span>{getParticipantDisplayName(user)}</span>
                      </div>
                      <button className="text-[#80889A]" onClick={() => addParticipantMutation.mutate(user._id)}>
                        <UserPlus className="size-4" />
                      </button>
                    </div>
                  ))}
                  {!userSearchQuery.data?.length ? <p className="p-3 text-sm text-[#8A91A1]">No user found.</p> : null}
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="mt-4 grid gap-2 text-[#434955] sm:grid-cols-2">
            <button
              className="flex items-center gap-2 text-left"
              onClick={() => {
                setSelectedDates({ from: new Date(event.startTime), to: new Date(event.endTime) });
                setDateDialogOpen(true);
              }}
            >
              <CalendarDays className="size-5" />
              {format(new Date(event.startTime), "dd MMM yyyy")} - {format(new Date(event.endTime), "dd MMM yyyy")}
            </button>
            <p className="flex items-center gap-2">
              <Clock3 className="size-5" />
              {event.isAllDay ? "All day" : `${format(new Date(event.startTime), "hh:mm a")} - ${format(new Date(event.endTime), "hh:mm a")}`}
            </p>
            <p className="flex items-center gap-2 sm:col-span-2">
              <Locate className="size-5" />
              {event.location || "No location"}
            </p>
          </div>

          <Dialog open={dateDialogOpen} onOpenChange={setDateDialogOpen}>
            <DialogContent className="max-w-md rounded-[26px]">
              <DialogHeader>
                <DialogTitle>Choose a date</DialogTitle>
              </DialogHeader>
              <Calendar
                mode="range"
                selected={selectedDates}
                onSelect={(range) => {
                  setSelectedDates(range);
                }}
              />
              <DialogFooter>
                <Button
                  onClick={() => {
                    if (!selectedDates?.from) {
                      toast.error("Please select at least start date");
                      return;
                    }

                    updateEventMutation.mutate({
                      startTime: selectedDates.from.toISOString(),
                      endTime: (selectedDates.to || selectedDates.from).toISOString(),
                    });
                    setDateDialogOpen(false);
                  }}
                >
                  Done
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Card>

        <div className="mt-4 grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
          <Card className="rounded-2xl bg-[#E8ECF3] p-4 shadow-none">
            <div className="space-y-2">
              {(eventTodosQuery.data || []).map((todo) => (
                <div key={todo._id} className="flex items-center gap-2 rounded-xl bg-[#F5F7FB] px-3 py-2">
                  <button
                    className={`size-5 rounded-full border ${todo.isCompleted ? "border-[#34C759] bg-[#34C759]" : "border-[#9EA6B8]"}`}
                    onClick={() =>
                      updateTodoMutation.mutate({
                        todoId: todo._id,
                        payload: { isCompleted: !todo.isCompleted },
                      })
                    }
                  />
                  <p className={`min-w-0 flex-1 truncate ${todo.isCompleted ? "text-[#9AA2B2] line-through" : "text-[#404653]"}`}>
                    {todo.text}
                  </p>
                  <button className="text-[#9BA2B2] hover:text-[#EA4335]" onClick={() => deleteTodoMutation.mutate(todo._id)}>
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              <Input
                value={newTodoText}
                onChange={(event) => setNewTodoText(event.target.value)}
                placeholder="New todo"
                className="h-10 rounded-lg bg-white"
              />
              <Button size="icon" className="size-10" onClick={() => addTodoMutation.mutate()}>
                <Plus className="size-4" />
              </Button>
            </div>
          </Card>

          <Card className="rounded-2xl bg-[#E8ECF3] p-4 shadow-none">
            <Tabs defaultValue="messages">
              <TabsList>
                <TabsTrigger value="messages">Messages</TabsTrigger>
                <TabsTrigger value="media">Media</TabsTrigger>
              </TabsList>

              <TabsContent value="messages" className="space-y-3">
                <div className="max-h-72 space-y-3 overflow-auto pt-1">
                  {messagesQuery.isLoading ? (
                    <SectionLoading rows={4} />
                  ) : (messagesQuery.data || []).length ? (
                    (messagesQuery.data || []).map((message) => (
                      <div key={message._id} className="space-y-1">
                        <p className="text-sm text-[#36A9E1]">{message.user.name || "Me"}</p>
                        <div className="rounded-2xl bg-white px-3 py-2 text-[#414754]">
                          {message.text || message.fileName || "Media"}
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState title="No messages" description="Start chatting with participants." />
                  )}
                </div>

                <div className="flex items-center gap-2 rounded-full bg-white px-2 py-1">
                  <label className="cursor-pointer px-1 text-[#9AA2B3]">
                    <ImagePlus className="size-5" />
                    <input
                      type="file"
                      className="hidden"
                      onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                    />
                  </label>
                  <Input
                    value={messageText}
                    onChange={(event) => setMessageText(event.target.value)}
                    placeholder="Type here..."
                    className="h-10 rounded-full border-none"
                  />
                  <button className="rounded-full p-1 text-[#36A9E1]" onClick={() => sendMessageMutation.mutate()}>
                    <Send className="size-4" />
                  </button>
                </div>
              </TabsContent>

              <TabsContent value="media">
                {mediaMessages.length ? (
                  <div className="grid max-h-80 grid-cols-2 gap-2 overflow-auto sm:grid-cols-4">
                    {mediaMessages.map((message) => (
                      <div key={message._id} className="overflow-hidden rounded-lg bg-white">
                        {message.mediaUrl ? (
                          <Image
                            src={message.mediaUrl}
                            alt={message.fileName || "media"}
                            width={200}
                            height={120}
                            className="h-24 w-full object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="flex h-24 items-center justify-center text-sm text-[#8F96A6]">{message.fileName}</div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="No media" description="Attach photos/files in chat and they will appear here." />
                )}
              </TabsContent>
            </Tabs>
          </Card>
        </div>

        <div className="mt-4 flex items-center gap-2">
          {participants.map((participant) => (
            <Avatar key={participant._id} className="size-8 border border-[#d2d8e5]">
              <AvatarImage src={participant.avatar?.url} />
              <AvatarFallback>{getParticipantDisplayName(participant).slice(0, 1)}</AvatarFallback>
            </Avatar>
          ))}
        </div>
      </section>
    </div>
  );
}
