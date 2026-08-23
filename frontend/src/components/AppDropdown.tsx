import { useEffect, useId, useMemo, useRef, useState } from 'react';

export interface AppDropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface AppDropdownProps {
  id?: string;
  label?: string;
  value: string;
  options: AppDropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  ariaLabel?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
}

export function AppDropdown({
  id,
  label,
  value,
  options,
  onChange,
  placeholder = 'Pilih opsi',
  disabled = false,
  required = false,
  className = '',
  ariaLabel,
  searchable = false,
  searchPlaceholder = 'Cari opsi...',
}: AppDropdownProps) {
  const generatedId = useId();
  const controlId = id || generatedId;
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find(option => option.value === value);
  const visibleOptions = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase('id');
    if (!normalizedSearch) return options;
    return options.filter(option => option.label.toLocaleLowerCase('id').includes(normalizedSearch));
  }, [options, searchTerm]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const chooseOption = (option: AppDropdownOption) => {
    if (option.disabled) return;
    onChange(option.value);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (event.key === 'Escape') {
      setIsOpen(false);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setIsOpen(open => !open);
    }
    if (event.key === 'ArrowDown' && !isOpen) {
      event.preventDefault();
      setIsOpen(true);
    }
  };

  return (
    <div className={`app-dropdown${isOpen ? ' is-open' : ''}${className ? ` ${className}` : ''}`} ref={dropdownRef}>
      {label && <label className="app-dropdown-label" htmlFor={controlId}>{label}</label>}
      <button
        id={controlId}
        type="button"
        className="app-dropdown-trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        aria-required={required || undefined}
        disabled={disabled}
        onClick={() => setIsOpen(open => {
          if (open) setSearchTerm('');
          return !open;
        })}
        onKeyDown={handleKeyDown}
      >
        <span className={selectedOption ? 'app-dropdown-value' : 'app-dropdown-placeholder'}>
          {selectedOption?.label || placeholder}
        </span>
        <span className="app-dropdown-chevron" aria-hidden="true">⌄</span>
      </button>
      {isOpen && (
        <div className="app-dropdown-menu" role="listbox" aria-labelledby={controlId}>
          {searchable && (
            <input
              type="search"
              className="app-dropdown-search"
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder={searchPlaceholder}
              aria-label={`${label || 'Pilihan'}: cari opsi`}
              autoFocus
            />
          )}
          {visibleOptions.map(option => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={`app-dropdown-option${option.value === value ? ' is-selected' : ''}`}
              disabled={option.disabled}
              onClick={() => chooseOption(option)}
            >
              <span>{option.label}</span>
              {option.value === value && <span className="app-dropdown-check" aria-hidden="true">✓</span>}
            </button>
          ))}
          {visibleOptions.length === 0 && <div className="app-dropdown-empty">Opsi tidak ditemukan.</div>}
        </div>
      )}
    </div>
  );
}
