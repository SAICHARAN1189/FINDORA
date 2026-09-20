// src/components/ui/Select.jsx
import { forwardRef } from 'react';

export const Select = forwardRef(({ className = '', children, ...props }, ref) => {
  return (
    <select
      ref={ref}
      className={`
        w-full px-4 py-2.5 rounded-lg
        bg-gray-800/50 border border-gray-700/50
        text-gray-100 placeholder-gray-500
        focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-all duration-200
        ${className}
      `}
      {...props}
    >
      {children}
    </select>
  );
});

Select.displayName = 'Select';

export default Select;
