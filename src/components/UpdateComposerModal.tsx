import { FormEvent, useState } from 'react';
import { Megaphone, X } from 'lucide-react';

interface UpdateComposerModalProps {
  onClose: () => void;
  onPublish: (title: string, body: string) => Promise<void>;
}

export default function UpdateComposerModal({ onClose, onPublish }: UpdateComposerModalProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    if (!cleanTitle || !cleanBody) {
      setError('Заполни заголовок и описание изменений.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onPublish(cleanTitle, cleanBody);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Не удалось опубликовать обновление.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[140] grid place-items-center bg-black/75 p-4 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby="update-composer-title" className="w-full max-w-sm overflow-hidden rounded-3xl border border-amber-300/25 bg-[#202326] shadow-2xl shadow-black/60">
        <header className="flex items-start justify-between gap-3 border-b border-white/5 px-5 py-4">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-amber-200"><Megaphone size={14} /> Для всех игроков</p>
            <h2 id="update-composer-title" className="mt-1 text-lg font-black text-white">Новое обновление</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 hover:bg-white/5 hover:text-white"><X size={17} /></button>
        </header>
        <form onSubmit={(event) => void submit(event)} className="space-y-3 p-5">
          <p className="text-[11px] leading-relaxed text-zinc-400">Игрок увидит это окно один раз при входе. После нажатия «Понятно» оно не появится снова.</p>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Заголовок
            <input
              autoFocus
              required
              maxLength={80}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Например: Новые контейнеры"
              className="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm font-semibold normal-case text-white outline-none placeholder:text-zinc-600 focus:border-amber-400"
            />
          </label>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Что изменилось
            <textarea
              required
              maxLength={3000}
              rows={6}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Опиши изменения простым текстом…"
              className="mt-1.5 w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm font-medium normal-case leading-relaxed text-white outline-none placeholder:text-zinc-600 focus:border-amber-400"
            />
            <span className="mt-1 block text-right text-[9px] font-normal normal-case text-zinc-600">{body.length} / 3000</span>
          </label>
          {error && <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">{error}</p>}
          <button type="submit" disabled={saving || !title.trim() || !body.trim()} className="w-full rounded-xl bg-amber-400 px-4 py-3 text-sm font-black text-[#151719] transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? 'Публикуем…' : 'Опубликовать игрокам'}
          </button>
        </form>
      </section>
    </div>
  );
}
