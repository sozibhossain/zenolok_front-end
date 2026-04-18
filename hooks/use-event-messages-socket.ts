"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { JamMessage } from "@/lib/api";
import { appendMessageIfMissing, upsertMessage } from "@/lib/jam-messages";
import { queryKeys } from "@/lib/query-keys";
import { getSharedSocket } from "@/lib/socket";

export function useEventMessagesSocket(eventId: string | undefined) {
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (!eventId) {
      return;
    }

    const socket = getSharedSocket();
    if (!socket) {
      return;
    }

    const joinEventRoom = () => {
      socket.emit("joinEventRoom", eventId);
    };

    const leaveEventRoom = () => {
      socket.emit("leaveEventRoom", eventId);
    };

    const handleNewMessage = (message: JamMessage) => {
      if (message.eventId !== eventId) {
        return;
      }

      queryClient.setQueryData<JamMessage[]>(
        queryKeys.jamMessages(eventId),
        (previous = []) => appendMessageIfMissing(previous, message),
      );
    };

    const handleDeleteMessage = (messageId: string) => {
      queryClient.setQueryData<JamMessage[]>(
        queryKeys.jamMessages(eventId),
        (previous = []) => previous.filter((message) => message._id !== messageId),
      );
    };

    const handleUpdateMessage = (message: JamMessage) => {
      if (message.eventId !== eventId) {
        return;
      }

      queryClient.setQueryData<JamMessage[]>(
        queryKeys.jamMessages(eventId),
        (previous = []) => upsertMessage(previous, message),
      );
    };

    socket.on("connect", joinEventRoom);
    socket.on("newMessage", handleNewMessage);
    socket.on("deleteMessage", handleDeleteMessage);
    socket.on("updateMessage", handleUpdateMessage);

    if (socket.connected) {
      joinEventRoom();
    }

    return () => {
      socket.off("connect", joinEventRoom);
      socket.off("newMessage", handleNewMessage);
      socket.off("deleteMessage", handleDeleteMessage);
      socket.off("updateMessage", handleUpdateMessage);
      leaveEventRoom();
    };
  }, [eventId, queryClient]);
}
