import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  type RemoteTrack,
  type RemoteTrackPublication,
  type RemoteParticipant,
} from 'livekit-client';
import { supabase } from '@/integrations/supabase/client';

interface LiveKitTokenResponse {
  token: string;
  url: string;
}

interface LiveKitIdentity {
  id: string;
  name?: string | null;
}

const getLiveKitToken = async ({
  roomName,
  identity,
  canPublish,
}: {
  roomName: string;
  identity: LiveKitIdentity;
  canPublish: boolean;
}) => {
  const { data, error } = await supabase.functions.invoke<LiveKitTokenResponse>('livekit-token', {
    body: {
      roomName,
      identity: identity.id,
      name: identity.name || identity.id,
      canPublish,
    },
  });

  if (error) throw error;
  if (!data?.token || !data?.url) {
    throw new Error('LiveKit token response is missing token or url');
  }

  return data;
};

const createPortraitRoom = () => new Room({
  adaptiveStream: true,
  dynacast: true,
  publishDefaults: {
    simulcast: false,
    videoEncoding: {
      maxBitrate: 900_000,
      maxFramerate: 24,
    },
  },
});

export function useLiveKitPublisher({
  roomName,
  localStream,
  identity,
  enabled,
}: {
  roomName: string | null;
  localStream: MediaStream | null;
  identity: LiveKitIdentity | null;
  enabled: boolean;
}) {
  const roomRef = useRef<Room | null>(null);
  const [connectionState, setConnectionState] = useState('disconnected');

  const cleanup = useCallback(() => {
    roomRef.current?.disconnect();
    roomRef.current = null;
    setConnectionState('disconnected');
  }, []);

  useEffect(() => {
    if (!enabled || !roomName || !localStream || !identity) {
      cleanup();
      return;
    }

    let cancelled = false;
    const room = createPortraitRoom();
    roomRef.current = room;

    room
      .on(RoomEvent.ConnectionStateChanged, (state) => {
        setConnectionState(String(state));
      })
      .on(RoomEvent.Disconnected, () => {
        setConnectionState('disconnected');
      });

    const connectAndPublish = async () => {
      const { token, url } = await getLiveKitToken({ roomName, identity, canPublish: true });
      if (cancelled) return;

      await room.connect(url, token, { autoSubscribe: false });
      if (cancelled) return;

      for (const track of localStream.getVideoTracks()) {
        await room.localParticipant.publishTrack(track, {
          source: Track.Source.Camera,
          name: 'muvit-portrait-camera',
          videoEncoding: {
            maxBitrate: 900_000,
            maxFramerate: 24,
          },
        });
      }

      for (const track of localStream.getAudioTracks()) {
        await room.localParticipant.publishTrack(track, {
          source: Track.Source.Microphone,
          name: 'muvit-microphone',
        });
      }
    };

    connectAndPublish().catch((error) => {
      console.error('LiveKit publisher error:', error);
      setConnectionState('failed');
    });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [cleanup, enabled, identity, localStream, roomName]);

  return { cleanup, connectionState };
}

export function useLiveKitViewer({
  roomName,
  identity,
  enabled,
}: {
  roomName: string | null;
  identity: LiveKitIdentity | null;
  enabled: boolean;
}) {
  const roomRef = useRef<Room | null>(null);
  const streamRef = useRef(new MediaStream());
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState('disconnected');

  const cleanup = useCallback(() => {
    roomRef.current?.disconnect();
    roomRef.current = null;
    streamRef.current = new MediaStream();
    setRemoteStream(null);
    setConnectionState('disconnected');
  }, []);

  useEffect(() => {
    if (!enabled || !roomName || !identity) {
      cleanup();
      return;
    }

    let cancelled = false;
    const room = createPortraitRoom();
    roomRef.current = room;

    const publishStream = () => {
      setRemoteStream(new MediaStream(streamRef.current.getTracks()));
    };

    const addTrack = (
      track: RemoteTrack,
      _publication: RemoteTrackPublication,
      _participant: RemoteParticipant,
    ) => {
      const mediaTrack = track.mediaStreamTrack;
      if (!mediaTrack || streamRef.current.getTracks().some((existing) => existing.id === mediaTrack.id)) {
        return;
      }
      streamRef.current.addTrack(mediaTrack);
      publishStream();
    };

    const removeTrack = (track: RemoteTrack) => {
      const mediaTrack = track.mediaStreamTrack;
      if (!mediaTrack) return;
      streamRef.current.removeTrack(mediaTrack);
      publishStream();
    };

    room
      .on(RoomEvent.TrackSubscribed, addTrack)
      .on(RoomEvent.TrackUnsubscribed, removeTrack)
      .on(RoomEvent.ConnectionStateChanged, (state) => {
        setConnectionState(String(state));
      })
      .on(RoomEvent.Disconnected, () => {
        setConnectionState('disconnected');
      });

    const connect = async () => {
      const { token, url } = await getLiveKitToken({ roomName, identity, canPublish: false });
      if (cancelled) return;
      await room.connect(url, token, { autoSubscribe: true });
      if (cancelled) return;

      room.remoteParticipants.forEach((participant) => {
        participant.trackPublications.forEach((publication) => {
          const track = publication.track;
          if (track) {
            addTrack(track as RemoteTrack, publication as RemoteTrackPublication, participant);
          }
        });
      });
    };

    connect().catch((error) => {
      console.error('LiveKit viewer error:', error);
      setConnectionState('failed');
    });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [cleanup, enabled, identity, roomName]);

  return { remoteStream, connectionState, cleanup };
}
