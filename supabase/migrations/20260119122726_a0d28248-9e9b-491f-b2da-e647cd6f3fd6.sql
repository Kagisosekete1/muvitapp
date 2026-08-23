-- Allow users to delete messages in their conversations (both participants can delete)
CREATE POLICY "Users can delete messages in their conversations"
ON public.messages
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = messages.conversation_id
    AND (c.participant_one = auth.uid() OR c.participant_two = auth.uid())
  )
);

-- Allow users to delete their own conversations
CREATE POLICY "Users can delete their own conversations"
ON public.conversations
FOR DELETE
USING (participant_one = auth.uid() OR participant_two = auth.uid());

-- Allow users to update conversation last_message_at
CREATE POLICY "Users can update their conversations"
ON public.conversations
FOR UPDATE
USING (participant_one = auth.uid() OR participant_two = auth.uid());