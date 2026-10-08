import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button, useToast } from '../../ui';
import { copyText } from './utils';

/** Copia `text` al portapapeles y confirma con "¡Copiado!". iconOnly → botón cuadrado de 44 px. */
export default function CopyButton({
  text,
  label = 'Copiar enlace',
  copiedLabel = '¡Copiado!',
  variant = 'secondary',
  size = 'md',
  iconOnly = false,
  className,
  ...props
}) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const handleClick = async (e) => {
    e.stopPropagation();
    const ok = await copyText(text);
    if (!ok) {
      toast.error('No se pudo copiar. Mantén presionado el enlace para copiarlo.');
      return;
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1800);
  };

  const Icon = copied ? Check : Copy;
  if (iconOnly) {
    return (
      <Button
        variant={variant}
        size="icon"
        className={className || 'h-11 w-11'}
        onClick={handleClick}
        aria-label={copied ? copiedLabel : label}
        title={copied ? copiedLabel : label}
        {...props}
      >
        <Icon className={copied ? 'h-4 w-4 text-toxic' : 'h-4 w-4'} />
      </Button>
    );
  }
  return (
    <Button variant={variant} size={size} className={className} onClick={handleClick} {...props}>
      <Icon className={copied ? 'h-4 w-4 text-toxic' : 'h-4 w-4'} />
      {copied ? copiedLabel : label}
    </Button>
  );
}
