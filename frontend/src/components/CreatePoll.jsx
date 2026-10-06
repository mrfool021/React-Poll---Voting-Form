import { useState } from 'react';
import { createPoll } from '../api.js';

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 10;

export default function CreatePoll({ onCreated, onCancel }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const updateOption = (index, value) =>
    setOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
  const addOption = () => setOptions((prev) => [...prev, '']);
  const removeOption = (index) => setOptions((prev) => prev.filter((_, i) => i !== index));

  function validate() {
    const q = question.trim();
    const opts = options.map((o) => o.trim());
    if (q.length < 5) return 'The question must be at least 5 characters long.';
    if (opts.some((o) => o.length === 0)) return 'Please fill in every option or remove the empty ones.';
    if (new Set(opts.map((o) => o.toLowerCase())).size !== opts.length) {
      return 'Options must be unique.';
    }
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
      });
      onCreated(poll.id);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <section>
      <h1 className="mb-6 text-2xl font-bold">Create a poll</h1>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <label htmlFor="question" className="mb-1 block text-sm font-medium">
            Question
          </label>
          <input
            id="question"
            type="text"
            value={question}
            maxLength={255}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="What would you like to ask?"
            className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            required
          />
        </div>

        <fieldset>
          <legend className="mb-1 block text-sm font-medium">Options</legend>
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
                  className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                {options.length > MIN_OPTIONS && (
                  <button
                    type="button"
                    onClick={() => removeOption(index)}
                    aria-label={`Remove option ${index + 1}`}
                    className="rounded-md border border-slate-300 px-3 text-slate-600 hover:bg-slate-100"
                  >
                    &times;
                  </button>
                )}
              </div>
            ))}
          </div>
          {options.length < MAX_OPTIONS && (
            <button
              type="button"
              onClick={addOption}
              className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              + Add option
            </button>
          )}
        </fieldset>

        {error && (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Creating…' : 'Create poll'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
