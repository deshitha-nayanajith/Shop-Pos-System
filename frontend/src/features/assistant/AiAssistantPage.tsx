import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useChat } from '@ai-sdk/react';
import {
  DefaultChatTransport,
  getToolName,
  isTextUIPart,
  isToolUIPart,
} from 'ai';
import type { PosAgentUIMessage } from '../../../api/_posAgent';

const QUICK_PROMPTS = [
  'Show all low-stock items that need restocking',
  "Give me today's store dashboard summary",
  'Search products for rice',
  'What are the top selling products?',
];

export const AiAssistantPage: React.FC = () => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        headers: () => {
          const headers: Record<string, string> = {};
          const token = localStorage.getItem('grocerypro_token');
          if (token) headers['Authorization'] = `Bearer ${token}`;
          const locationId = localStorage.getItem('grocerypro_location_id');
          if (locationId) headers['X-Location-Id'] = locationId;
          return headers;
        },
      }),
    []
  );

  const { messages, sendMessage, status, stop, error, clearError, setMessages } =
    useChat<PosAgentUIMessage>({
      transport,
    });

  const isBusy = status === 'streaming' || status === 'submitted';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isBusy) return;
    setInput('');
    sendMessage({ text: trimmed });
  };

  const handleQuickPrompt = (prompt: string) => {
    if (isBusy) return;
    sendMessage({ text: prompt });
  };

  return (
    <div className="container-fluid h-100 d-flex flex-column" style={{ maxWidth: 960 }}>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h4 className="mb-0 fw-bold d-flex align-items-center gap-2">
            <i className="bi bi-stars text-success"></i>
            GroceryPro AI Assistant
          </h4>
          <small className="text-muted">
            Ask about stock levels, low-stock alerts, products, or sales reports
          </small>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => setMessages([])}
            disabled={isBusy}
          >
            <i className="bi bi-trash me-1"></i>
            Clear Chat
          </button>
        )}
      </div>

      {error && (
        <div className="alert alert-danger d-flex justify-content-between align-items-center py-2">
          <span>
            <i className="bi bi-exclamation-triangle-fill me-2"></i>
            {error.message || 'Failed to reach the AI assistant.'}
          </span>
          <button
            type="button"
            className="btn-close btn-sm"
            aria-label="Close"
            onClick={() => clearError()}
          ></button>
        </div>
      )}

      <div
        className="card border-0 shadow-sm flex-grow-1 d-flex flex-column overflow-hidden"
        style={{ minHeight: '62vh', maxHeight: '72vh' }}
      >
        <div className="card-body overflow-auto p-3 p-md-4 flex-grow-1">
          {messages.length === 0 ? (
            <div className="text-center py-5">
              <div
                className="d-inline-flex align-items-center justify-content-center rounded-circle bg-success bg-opacity-10 text-success mb-3"
                style={{ width: 56, height: 56 }}
              >
                <i className="bi bi-robot fs-3"></i>
              </div>
              <h5 className="fw-semibold">How can I help with your store today?</h5>
              <p className="text-muted small mb-4">
                Powered by Vercel AI SDK <code>ToolLoopAgent</code> connected to your live GroceryPro API.
              </p>
              <div className="d-flex flex-wrap justify-content-center gap-2">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="btn btn-outline-success btn-sm rounded-pill px-3"
                    onClick={() => handleQuickPrompt(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="d-flex flex-column gap-3">
              {messages.map((message) => {
                const isUser = message.role === 'user';
                return (
                  <div
                    key={message.id}
                    className={`d-flex ${isUser ? 'justify-content-end' : 'justify-content-start'}`}
                  >
                    <div
                      className={`p-3 rounded-3 ${
                        isUser
                          ? 'bg-success text-white'
                          : 'bg-light border text-dark'
                      }`}
                      style={{ maxWidth: '82%' }}
                    >
                      <div className="small fw-semibold mb-1 opacity-75">
                        {isUser ? 'You' : 'GroceryPro AI'}
                      </div>
                      {message.parts.map((part, idx) => {
                        if (isTextUIPart(part)) {
                          return (
                            <div
                              key={idx}
                              style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}
                            >
                              {part.text}
                            </div>
                          );
                        }

                        if (isToolUIPart(part)) {
                          const toolName = getToolName(part);
                          const isDone = part.state === 'output-available';
                          const isError = part.state === 'output-error';
                          return (
                            <div
                              key={idx}
                              className="my-1 px-2 py-1 rounded bg-white border small text-muted d-inline-flex align-items-center gap-2 me-2"
                            >
                              <i
                                className={`bi ${
                                  isError
                                    ? 'bi-x-circle text-danger'
                                    : isDone
                                      ? 'bi-check-circle-fill text-success'
                                      : 'bi-hourglass-split text-warning'
                                }`}
                              ></i>
                              <span>
                                {toolName}
                                {isDone ? ' ✓' : isError ? ' (failed)' : '...'}
                              </span>
                            </div>
                          );
                        }

                        return null;
                      })}
                    </div>
                  </div>
                );
              })}

              {isBusy && (
                <div className="d-flex justify-content-start">
                  <div className="px-3 py-2 rounded-3 bg-light border text-muted small d-flex align-items-center gap-2">
                    <span className="spinner-border spinner-border-sm text-success"></span>
                    Thinking...
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="card-footer bg-white border-top p-3">
          <div className="input-group">
            <input
              type="text"
              className="form-control"
              placeholder="Ask about stock, products, low-stock alerts, or sales..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isBusy}
            />
            {isBusy ? (
              <button
                type="button"
                className="btn btn-outline-danger px-3"
                onClick={() => stop()}
              >
                <i className="bi bi-stop-fill me-1"></i>
                Stop
              </button>
            ) : (
              <button
                type="submit"
                className="btn btn-success px-4"
                disabled={!input.trim()}
              >
                <i className="bi bi-send-fill me-1"></i>
                Send
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
