import { useRef, useState } from 'react';
import { createPoll } from '../api.js';
import { formatBytes, preparePollImage } from '../imageUtils.js';
import { links, navigate } from '../router.js';
import Icon from './Icons.jsx';

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 10;

export default function CreatePoll() {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [image, setImage] = useState(null); // { dataUrl, bytes, name }
  const [processing, setProcessing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const updateOption = (i, v) => setOptions((p) => p.map((o, idx) => (idx === i ? v : o)));
  const addOption = () => setOptions((p) => [...p, '']);
  const removeOption = (i) => setOptions((p) => p.filter((_, idx) => idx !== i));

  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow picking the same file again
    if (!file) return;
    setProcessing(true);
    setError('');
    try {
      const prepared = await preparePollImage(file);
      setImage({ ...prepared, name: file.name });
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  }

  // The photo is never sent alone: the poll itself must be complete first.
  function validate() {
    const q = question.trim();
    const opts = options.map((o) => o.trim());
    if (q.length < 5) return 'The question must be at least 5 characters long.';
    if (opts.some((o) => o.length === 0)) return 'Please fill in every option or remove the empty ones.';
    if (new Set(opts.map((o) => o.toLowerCase())).size !== opts.length) return 'Options must be unique.';
    return '';
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const poll = await createPoll({
        question: question.trim(),
        options: options.map((o) => o.trim()),
        ...(image ? { image: image.dataUrl } : {}),
      });
      navigate(links.poll(poll.id));
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-2xl">
      <a href={links.home()} className="btn-ghost -ml-3 mb-2 w-fit">
        <Icon name="arrowLeft" className="h-4 w-4" /> Back
      </a>
      <h1 className="mb-1 font-display text-3xl font-extrabold">
        Create a <span className="text-gradient">poll</span>
      </h1>
      <p className="mb-6 text-sm text-muted">Ask the community anything. Add a screenshot or photo to make it pop.</p>

      <form onSubmit={handleSubmit} className="card space-y-6 p-4 sm:p-6" noValidate>
        <div>
          <label htmlFor="question" className="label">
            Question
          </label>
          <input
            id="question"
            type="text"
            value={question}
            maxLength={255}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Best FPS of all time?"
            className="input"
            required
          />
          <p className="mt-1 text-right text-xs text-muted">{question.length}/255</p>
        </div>

        {/* ---- Photo ---- */}
        <div>
          <span className="label">
            Photo <span className="font-normal text-muted">(optional)</span>
          </span>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleFile} className="sr-only" aria-label="Choose a photo" tabIndex={-1} />

          {image ? (
            <div className="overflow-hidden rounded-xl border border-line bg-raised">
              <img src={image.dataUrl} alt="Selected poll attachment preview" className="max-h-80 w-full object-contain" />
              <div className="flex items-center justify-between gap-2 border-t border-line p-2.5 text-xs text-muted">
                <span className="min-w-0 truncate">
                  {image.name} &middot; {formatBytes(image.bytes)}
                </span>
                <span className="flex shrink-0 gap-1">
                  <button type="button" className="btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
                    Replace
                  </button>
                  <button type="button" className="btn-danger btn-sm" onClick={() => setImage(null)}>
                    <Icon name="trash" className="h-3.5 w-3.5" /> Remove
                  </button>
                </span>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={processing}
              className="flex min-h-[7rem] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line bg-raised/40 p-4 text-sm text-muted transition hover:border-brand hover:text-ink disabled:opacity-60"
            >
              <Icon name="image" className="h-7 w-7 text-brand" />
              {processing ? 'Optimising image…' : 'Tap to add a photo'}
              <span className="text-xs">JPG, PNG, WebP or GIF &middot; auto-compressed</span>
            </button>
          )}
          <p className="mt-2 text-xs text-muted">
            A photo is always posted <em>together</em> with the poll &mdash; it cannot be published on its own.
          </p>
        </div>

        <fieldset>
          <legend className="label">Options</legend>
          <div className="space-y-2">
            {options.map((option, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={option}
                  maxLength={120}
                  onChange={(e) => updateOption(index, e.target.value)}
                  placeholder={`Option ${index + 1}`}
                  aria-label={`Option ${index + 1}`}
                  className="input"
                />
                {options.length > MIN_OPTIONS && (
                  <button type="button" onClick={() => removeOption(index)} aria-label={`Remove option ${index + 1}`} className="icon-btn shrink-0 border border-line">
                    <Icon name="x" className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {options.length < MAX_OPTIONS && (
            <button type="button" onClick={addOption} className="btn-ghost mt-2 text-brand">
              <Icon name="plus" className="h-4 w-4" /> Add option
            </button>
          )}
        </fieldset>

        {error && (
          <p role="alert" className="notice-error">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <a href={links.home()} className="btn-outline">
            Cancel
          </a>
          <button type="submit" disabled={submitting || processing} className="btn-primary sm:min-w-[10rem]">
            {submitting ? 'Publishing…' : 'Publish poll'}
          </button>
        </div>
      </form>
    </section>
  );
}
