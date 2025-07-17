import React, { useRef, useState, useEffect } from 'react';
import './ch-input.css';

export default function ChatInput({ onSend }) {
  const editorRef = useRef(null);
  const [formState, setFormState] = useState({
    charCount: 0,
    sending: false,
    error: null
  });

  // Executing Rich Text Editor Commands
  const execCmd = (command) => {
    document.execCommand(command, false, null);
    // Force updates to maintain button status and character count
    updateCharCount();
  };

  // Update Character Count
  const updateCharCount = () => {
    if (editorRef.current) {
      // Get plain text content length (remove HTML tags)
      const textContent = editorRef.current.textContent || '';
      setFormState(prev => ({
        ...prev,
        charCount: textContent.length
      }));
    }
  };

  // Listening for editor content changes
  useEffect(() => {
    const editor = editorRef.current;
    if (editor) {
      // Listening to input events
      const handleInput = () => updateCharCount();
      editor.addEventListener('input', handleInput);

      // Cleanup Functions
      return () => {
        editor.removeEventListener('input', handleInput);
      };
    }
  }, []);

  // Handling Sent Messages
  const handleSend = async () => {
    // Get message content
    const message = editorRef.current.innerHTML.trim();

    // Verify message length
    if (!message) {
      return;
    }

    if (formState.charCount > 2000) {
      setFormState(prev => ({
        ...prev,
        error: 'Message too long. Maximum 2000 characters allowed.'
      }));
      return;
    }

    try {
      // Setting the sending status
      setFormState(prev => ({ ...prev, sending: true, error: null }));

      // Calls the send function of the parent component
      await onSend(message);

      // Clear the editor after a successful send
      editorRef.current.innerHTML = '';
      updateCharCount();
    } catch (error) {
      setFormState(prev => ({
        ...prev,
        error: error.message || 'Failed to send message'
      }));
    } finally {
      setFormState(prev => ({ ...prev, sending: false }));
    }
  };

  // Handling Keyboard Events
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="mt-4">
      {formState.error && (
        <div className="mb-2 px-3 py-2 text-sm text-red-700 bg-red-100 rounded-md">
          {formState.error}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-2 text-gray-600">
        <button onClick={() => execCmd('bold')} title="Bold" className="hover:text-indigo-600 font-bold">B</button>
        <button onClick={() => execCmd('italic')} title="Italic" className="hover:text-indigo-600 italic">I</button>
        <button onClick={() => execCmd('underline')} title="Underline" className="hover:text-indigo-600 underline">U</button>
        <button onClick={() => execCmd('insertOrderedList')} title="Numbered List" className="hover:text-indigo-600">1.</button>
        <button onClick={() => execCmd('insertUnorderedList')} title="Bullet List" className="hover:text-indigo-600">•</button>
        <span className="ml-auto text-xs text-gray-500">{formState.charCount}/2000</span>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        className={`min-h-[100px] w-full border rounded-md p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-300 ${formState.charCount > 2000 ? 'border-red-500' : 'border-gray-300'
          }`}
        placeholder="Enter a message... (Shift+Enter for newline)"
        onKeyDown={handleKeyDown}
        onInput={updateCharCount}
        aria-label="Message input"
      ></div>

      {/* Send Button */}
      <button
        onClick={handleSend}
        disabled={formState.sending || formState.charCount === 0 || formState.charCount > 2000}
        className="mt-3 px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
      >
        {formState.sending ? 'Sending...' : 'Send'}
      </button>
    </div>
  );
}
