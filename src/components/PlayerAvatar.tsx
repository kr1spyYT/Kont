import { useState } from 'react';

interface PlayerAvatarProps {
  photoUrl?: string;
  name: string;
  className?: string;
}

export default function PlayerAvatar({ photoUrl, name, className = '' }: PlayerAvatarProps) {
  const [failedUrl, setFailedUrl] = useState('');
  const initial = name.trim().replace(/^@/, '').charAt(0).toLocaleUpperCase('ru-RU') || 'И';

  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden rounded-full border border-amber-300/20 bg-zinc-900 font-black text-amber-100 ${className}`}>
      {photoUrl && failedUrl !== photoUrl
        ? <img src={photoUrl} alt={`Фото профиля: ${name}`} onError={() => setFailedUrl(photoUrl)} className="h-full w-full object-cover" />
        : <span aria-hidden="true">{initial}</span>}
    </span>
  );
}
