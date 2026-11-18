import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  Ban,
  Check,
  CheckCheck,
  Flag,
  Image as ImageIcon,
  MessageSquare,
  Send,
  ShieldAlert,
  Unlock,
} from 'lucide-react';
import {useAuth} from '../../contexts/AuthContext';
import {useToast} from '../../contexts/ToastContext';
import {db, handleFirestoreError, OperationType} from '../../services/firebase/firebaseClient';
import {ChatMessage, Conversation} from '../../types';
import {SafeImage} from '../../components/SafeImage';

interface MessagingModuleProps {
  initialConversationId?: string | null;
}

/**
 * Private 1:1 Messaging Module.
 * Strictly ad-free per Experience Protection Rule (no ads inside private chats).
 */
export const MessagingModule: React.FC<MessagingModuleProps> = ({initialConversationId}) => {
  const {firebaseUser} = useAuth();
  const {showToast} = useToast();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialConversationId || null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draftText, setDraftText] = useState('');
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [showImageAttach, setShowImageAttach] = useState(false);
  const [sending, setSending] = useState(false);

  const [showReportBox, setShowReportBox] = useState(false);
  const [reportReason, setReportReason] = useState('Comportamiento inapropiado o spam');
  const [reportDetails, setReportDetails] = useState('');

  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (initialConversationId) {
      setSelectedId(initialConversationId);
    }
  }, [initialConversationId]);

  // Listen to user's conversations
  useEffect(() => {
    if (!firebaseUser) return;
    const q = query(
      collection(db, 'conversations'),
      where('participantIds', 'array-contains', firebaseUser.uid)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<Conversation, 'id'>)}));
        list.sort((a, b) => {
          const tA = (a.updatedAt as {seconds?: number})?.seconds || 0;
          const tB = (b.updatedAt as {seconds?: number})?.seconds || 0;
          return tB - tA;
        });
        setConversations(list);
        if (!selectedId && list.length > 0) {
          setSelectedId(list[0].id);
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'conversations')
    );
    return () => unsub();
  }, [firebaseUser, selectedId]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === selectedId) || null,
    [conversations, selectedId]
  );

  // Listen to messages in selected conversation
  useEffect(() => {
    if (!selectedId || !firebaseUser) {
      setMessages([]);
      return;
    }
    const q = query(
      collection(db, 'conversations', selectedId, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<ChatMessage, 'id'>)}));
        setMessages(list);
        // Mark incoming unread messages as read
        list.forEach((msg) => {
          if (msg.senderId !== firebaseUser.uid && !msg.read) {
            void updateDoc(doc(db, 'conversations', selectedId, 'messages', msg.id), {
              read: true,
            }).catch(() => {
              // ignore non-critical read marker errors
            });
          }
        });
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `conversations/${selectedId}/messages`)
    );
    return () => unsub();
  }, [selectedId, firebaseUser]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({behavior: 'smooth'});
  }, [messages.length, selectedId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !activeConversation) return;
    if (activeConversation.status === 'blocked') {
      showToast('Esta conversación se encuentra bloqueada.', 'error');
      return;
    }
    const text = draftText.trim();
    const img = imageUrlInput.trim();
    if (!text && !img) return;
    if (img && !/^https?:\/\//i.test(img)) {
      showToast('La URL de imagen debe comenzar con http:// o https://', 'error');
      return;
    }

    setSending(true);
    try {
      const payload: Record<string, unknown> = {
        senderId: firebaseUser.uid,
        text: text || 'Imagen adjunta',
        read: false,
        createdAt: serverTimestamp(),
      };
      if (img) {
        payload.imageUrl = img;
      }

      await addDoc(collection(db, 'conversations', activeConversation.id, 'messages'), payload);
      await updateDoc(doc(db, 'conversations', activeConversation.id), {
        lastMessage: (text || 'Imagen adjunta').slice(0, 120),
        lastMessageAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const recipientUid = activeConversation.participantIds.find((uid) => uid !== firebaseUser.uid);
      if (recipientUid) {
        void addDoc(collection(db, 'notifications'), {
          userId: recipientUid,
          type: 'new_message',
          title: 'Nuevo mensaje en MATCH+',
          body: `${activeConversation.participantNames[firebaseUser.uid] || 'Contacto'}: ${(text || 'Imagen adjunta').slice(0, 80)}`,
          module: activeConversation.module,
          relatedId: activeConversation.id,
          read: false,
          createdAt: serverTimestamp(),
        }).catch(() => {});
      }

      setDraftText('');
      setImageUrlInput('');
      setShowImageAttach(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `conversations/${activeConversation.id}/messages`);
    } finally {
      setSending(false);
    }
  };

  const handleToggleBlock = async () => {
    if (!firebaseUser || !activeConversation) return;
    const isBlocked = activeConversation.status === 'blocked';
    if (isBlocked && activeConversation.blockedBy && activeConversation.blockedBy !== firebaseUser.uid) {
      showToast('Solo quien bloqueó la conversación puede desbloquearla.', 'error');
      return;
    }
    try {
      await updateDoc(doc(db, 'conversations', activeConversation.id), {
        status: isBlocked ? 'active' : 'blocked',
        blockedBy: isBlocked ? null : firebaseUser.uid,
        updatedAt: serverTimestamp(),
      });
      showToast(isBlocked ? 'Conversación reactivada.' : 'Conversación bloqueada.', 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `conversations/${activeConversation.id}`);
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !activeConversation) return;
    try {
      await addDoc(collection(db, 'reports'), {
        reporterId: firebaseUser.uid,
        targetType: 'message',
        targetId: activeConversation.id,
        module: activeConversation.module,
        reason: reportReason,
        details: reportDetails.trim() || 'Reporte emitido desde chat privado.',
        status: 'open',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setShowReportBox(false);
      setReportDetails('');
      showToast('Reporte enviado al equipo de moderación.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'reports');
    }
  };

  const getCounterpartName = (conv: Conversation) => {
    if (!firebaseUser) return 'Contacto';
    const otherUid = conv.participantIds.find((id) => id !== firebaseUser.uid);
    return (otherUid && conv.participantNames?.[otherUid]) || 'Contacto MATCH+';
  };

  const formatMsgTime = (ts: unknown) => {
    const seconds = (ts as {seconds?: number})?.seconds;
    if (!seconds) return 'Ahora';
    return new Date(seconds * 1000).toLocaleTimeString('es-CL', {hour: '2-digit', minute: '2-digit'});
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Mensajería Privada</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Chats directos habilitados tras coincidencia mutua. Espacio privado y completamente libre de publicidad.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-[540px]">
        {/* Conversations List */}
        <div className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Conversaciones ({conversations.length})
            </span>
          </div>
          {conversations.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400 my-auto space-y-2">
              <MessageSquare className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
              <p className="font-semibold text-slate-700 dark:text-slate-200">Sin conversaciones activas</p>
              <p className="text-xs">
                Cuando logres un match mutuo en MATCH COMERCIAL o MATCH LABORAL, se abrirá aquí el canal directo.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 overflow-y-auto flex-1">
              {conversations.map((conv) => {
                const active = conv.id === selectedId;
                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => setSelectedId(conv.id)}
                    className={`w-full text-left px-4 py-3.5 transition-colors min-h-[64px] ${
                      active
                        ? 'bg-blue-50 dark:bg-blue-950/50'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {getCounterpartName(conv)}
                      </p>
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {conv.module === 'commercial' ? 'Comercial' : 'Laboral'}
                      </span>
                    </div>
                    <p className="text-xs text-blue-700 dark:text-blue-400 font-medium truncate mt-0.5">
                      {conv.targetTitle}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-1">
                      {conv.status === 'blocked' ? 'Conversación bloqueada' : conv.lastMessage || 'Conversación iniciada'}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Active Chat Thread */}
        <div className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col overflow-hidden">
          {!activeConversation ? (
            <div className="m-auto p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Selecciona una conversación para ver los mensajes.
            </div>
          ) : (
            <>
              <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    {getCounterpartName(activeConversation)}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {activeConversation.module === 'commercial' ? 'MATCH COMERCIAL' : 'MATCH LABORAL'} ·{' '}
                    {activeConversation.targetTitle}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowReportBox((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[40px]"
                  >
                    <Flag className="w-3.5 h-3.5" />
                    <span>Reportar</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleBlock}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold min-h-[40px] ${
                      activeConversation.status === 'blocked'
                        ? 'border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400'
                        : 'border-rose-200 text-rose-700 dark:border-rose-900 dark:text-rose-400'
                    }`}
                  >
                    {activeConversation.status === 'blocked' ? (
                      <>
                        <Unlock className="w-3.5 h-3.5" />
                        <span>Desbloquear</span>
                      </>
                    ) : (
                      <>
                        <Ban className="w-3.5 h-3.5" />
                        <span>Bloquear</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {showReportBox && (
                <form
                  onSubmit={handleSubmitReport}
                  className="px-5 py-4 bg-rose-50/60 dark:bg-rose-950/30 border-b border-rose-200 dark:border-rose-900 space-y-3"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-rose-800 dark:text-rose-300">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Reportar conversación a moderación</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <select
                      value={reportReason}
                      onChange={(e) => setReportReason(e.target.value)}
                      className="px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-900 text-xs"
                    >
                      <option>Comportamiento inapropiado o spam</option>
                      <option>Sospecha de fraude o estafa</option>
                      <option>Acoso o trato discriminatorio</option>
                      <option>Suplantación de identidad</option>
                    </select>
                    <input
                      type="text"
                      value={reportDetails}
                      onChange={(e) => setReportDetails(e.target.value)}
                      placeholder="Describe brevemente lo ocurrido..."
                      className="px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-900 text-xs"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowReportBox(false)}
                      className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold"
                    >
                      Enviar denuncia
                    </button>
                  </div>
                </form>
              )}

              <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-3 max-h-[420px] bg-slate-50/50 dark:bg-slate-950/40">
                {messages.length === 0 ? (
                  <p className="text-center text-xs text-slate-500 dark:text-slate-400 py-8">
                    Envía el primer mensaje para coordinar detalles directamente.
                  </p>
                ) : (
                  messages.map((msg) => {
                    const isMine = msg.senderId === firebaseUser?.uid;
                    return (
                      <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm space-y-1.5 ${
                            isMine
                              ? 'bg-blue-700 text-white rounded-br-sm'
                              : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-sm'
                          }`}
                        >
                          {msg.imageUrl && (
                            <div className="rounded-xl overflow-hidden max-w-xs mb-1">
                              <SafeImage
                                src={msg.imageUrl}
                                alt="Adjunto en chat"
                                className="w-full h-40 object-cover"
                                fallbackLabel="Imagen adjunta"
                              />
                            </div>
                          )}
                          <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                          <div
                            className={`flex items-center justify-end gap-1 text-[10px] tabular-nums ${
                              isMine ? 'text-blue-200' : 'text-slate-400'
                            }`}
                          >
                            <span>{formatMsgTime(msg.createdAt)}</span>
                            {isMine &&
                              (msg.read ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>

              <form
                onSubmit={handleSendMessage}
                className="p-3 sm:p-4 border-t border-slate-100 dark:border-slate-800 space-y-2"
              >
                {showImageAttach && (
                  <input
                    type="url"
                    value={imageUrlInput}
                    onChange={(e) => setImageUrlInput(e.target.value)}
                    placeholder="Pega la URL de imagen (https://...)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                  />
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowImageAttach((v) => !v)}
                    aria-label="Adjuntar imagen por URL"
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center"
                  >
                    <ImageIcon className="w-4 h-4" />
                  </button>
                  <input
                    type="text"
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    disabled={activeConversation.status === 'blocked'}
                    placeholder={
                      activeConversation.status === 'blocked'
                        ? 'Conversación bloqueada'
                        : 'Escribe un mensaje...'
                    }
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm min-h-[44px]"
                  />
                  <button
                    type="submit"
                    disabled={sending || activeConversation.status === 'blocked'}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-sm font-semibold min-h-[44px] whitespace-nowrap"
                  >
                    <Send className="w-4 h-4" />
                    <span className="hidden sm:inline">Enviar</span>
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
