import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

export interface AutoResizeTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  minRows?: number;
  maxHeight?: number;
}

export const AutoResizeTextarea = forwardRef<HTMLTextAreaElement, AutoResizeTextareaProps>(
  ({ value, onChange, minRows = 1, maxHeight, className = '', style, ...props }, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    useImperativeHandle(ref, () => textareaRef.current!);

    const adjustHeight = () => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      // Reset height to let scrollHeight calculate based on content
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;

      if (maxHeight && scrollHeight > maxHeight) {
        textarea.style.height = `${maxHeight}px`;
        textarea.style.overflowY = 'auto';
      } else {
        textarea.style.height = `${scrollHeight}px`;
        textarea.style.overflowY = 'hidden';
      }
    };

    useEffect(() => {
      adjustHeight();
    }, [value]);

    useEffect(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const resizeObserver = new ResizeObserver(() => {
        adjustHeight();
      });
      resizeObserver.observe(textarea);

      return () => {
        resizeObserver.disconnect();
      };
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange?.(e);
      adjustHeight();
    };

    return (
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        rows={minRows}
        className={`resize-none transition-[height] duration-75 block w-full ${className}`}
        style={{ ...style }}
        {...props}
      />
    );
  }
);

AutoResizeTextarea.displayName = 'AutoResizeTextarea';
