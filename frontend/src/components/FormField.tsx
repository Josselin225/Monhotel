import React from 'react'

interface FormFieldProps {
  label: string
  icon?: string
  error?: string
  required?: boolean
  hint?: string
  children: React.ReactElement<React.InputHTMLAttributes<HTMLElement> & { className?: string }>
}

export default function FormField({ label, icon, error, required, hint, children }: FormFieldProps) {
  const child = React.cloneElement(children, {
    className: [
      'block w-full bg-transparent py-2.5 text-sm transition-all duration-150',
      'border-0 border-b-2 rounded-none',
      'focus:outline-none focus:ring-0',
      icon ? 'pl-9 pr-3' : 'px-0',
      error
        ? 'border-red-400 text-red-900 dark:text-red-200 placeholder:text-red-300 focus:border-red-500'
        : 'border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-amber-500',
      children.props.className ?? '',
    ].join(' '),
  })

  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-600">
        {label}
        {required && <span className="text-amber-500 font-bold">*</span>}
      </label>
      <div className="relative">
        {icon && (
          <span className={`pointer-events-none absolute inset-y-0 left-0 flex items-center ${error ? 'text-red-400' : 'text-gray-500'}`}>
            <i className={`bi ${icon} text-sm`} />
          </span>
        )}
        {child}
        {error && (
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center">
            <i className="bi bi-exclamation-circle text-red-400 text-sm" />
          </span>
        )}
      </div>
      {error && (
        <p className="text-xs text-red-500 font-medium">{error}</p>
      )}
      {hint && !error && (
        <p className="text-xs text-gray-400">{hint}</p>
      )}
    </div>
  )
}
