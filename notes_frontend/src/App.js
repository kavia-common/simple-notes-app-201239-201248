import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';

/**
 * API base URL.
 * - In dev/preview, backend is on http://localhost:3001
 * - You can override with REACT_APP_API_BASE_URL
 */
const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');

// PUBLIC_INTERFACE
function App() {
  const [notes, setNotes] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');

  // Form state (used for both create and edit)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  // Delete confirm modal state
  const [confirmDelete, setConfirmDelete] = useState({ open: false, note: null });

  const resetForm = useCallback(() => {
    setEditingNote(null);
    setTitle('');
    setContent('');
  }, []);

  const openCreate = useCallback(() => {
    setError('');
    resetForm();
    setIsFormOpen(true);
  }, [resetForm]);

  const openEdit = useCallback((note) => {
    setError('');
    setEditingNote(note);
    setTitle(note.title || '');
    setContent(note.content || '');
    setIsFormOpen(true);
  }, []);

  const closeForm = useCallback(() => {
    setIsFormOpen(false);
    resetForm();
  }, [resetForm]);

  const fetchNotes = useCallback(async () => {
    setError('');
    setLoadingList(true);
    try {
      const res = await fetch(`${API_BASE_URL}/notes`);
      if (!res.ok) throw new Error(`Failed to fetch notes (${res.status})`);
      const data = await res.json();
      setNotes(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || 'Failed to load notes');
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const isEditing = useMemo(() => Boolean(editingNote && editingNote.id), [editingNote]);

  const validateForm = useCallback(() => {
    const trimmed = title.trim();
    if (!trimmed) return 'Title is required.';
    if (trimmed.length > 200) return 'Title is too long (max 200 characters).';
    if (content.length > 50000) return 'Content is too long (max 50,000 characters).';
    return '';
  }, [title, content]);

  const onSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setError('');

      const validationError = validateForm();
      if (validationError) {
        setError(validationError);
        return;
      }

      const payload = { title: title.trim(), content };

      // Optimistic UI: update list immediately, then reconcile with server response.
      setSaving(true);

      if (!isEditing) {
        const tempId = `temp-${Date.now()}`;
        const optimistic = {
          id: tempId,
          title: payload.title,
          content: payload.content,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          _optimistic: true,
        };

        setNotes((prev) => [optimistic, ...prev]);

        try {
          const res = await fetch(`${API_BASE_URL}/notes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (!res.ok) throw new Error(`Failed to create note (${res.status})`);
          const created = await res.json();

          setNotes((prev) => prev.map((n) => (n.id === tempId ? created : n)));
          closeForm();
        } catch (e2) {
          // Rollback optimistic insert
          setNotes((prev) => prev.filter((n) => n.id !== tempId));
          setError(e2.message || 'Failed to create note');
        } finally {
          setSaving(false);
        }

        return;
      }

      // Editing: optimistic update in-place.
      const originalId = editingNote.id;
      const originalSnapshot = notes.find((n) => n.id === originalId);

      setNotes((prev) =>
        prev.map((n) =>
          n.id === originalId
            ? { ...n, title: payload.title, content: payload.content, updated_at: new Date().toISOString(), _optimistic: true }
            : n
        )
      );

      try {
        const res = await fetch(`${API_BASE_URL}/notes/${originalId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`Failed to update note (${res.status})`);
        const updated = await res.json();

        setNotes((prev) => prev.map((n) => (n.id === originalId ? updated : n)));
        closeForm();
      } catch (e3) {
        // Rollback optimistic edit
        if (originalSnapshot) {
          setNotes((prev) => prev.map((n) => (n.id === originalId ? originalSnapshot : n)));
        }
        setError(e3.message || 'Failed to update note');
      } finally {
        setSaving(false);
      }
    },
    [closeForm, content, editingNote, isEditing, notes, title, validateForm]
  );

  const requestDelete = useCallback((note) => {
    setError('');
    setConfirmDelete({ open: true, note });
  }, []);

  const closeDeleteConfirm = useCallback(() => {
    setConfirmDelete({ open: false, note: null });
  }, []);

  const confirmDeleteNow = useCallback(async () => {
    if (!confirmDelete.note) return;
    const note = confirmDelete.note;

    setError('');
    setDeletingId(note.id);

    // Optimistic remove
    const previous = notes;
    setNotes((prev) => prev.filter((n) => n.id !== note.id));
    closeDeleteConfirm();

    try {
      const res = await fetch(`${API_BASE_URL}/notes/${note.id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error(`Failed to delete note (${res.status})`);
    } catch (e) {
      // Rollback
      setNotes(previous);
      setError(e.message || 'Failed to delete note');
    } finally {
      setDeletingId(null);
    }
  }, [closeDeleteConfirm, confirmDelete.note, notes]);

  return (
    <div className="AppShell">
      <header className="Header">
        <div className="HeaderInner">
          <div className="Brand">
            <div className="BrandMark" aria-hidden="true" />
            <div>
              <div className="BrandTitle">Notes</div>
              <div className="BrandSubtitle">Create, edit, and manage your notes</div>
            </div>
          </div>

          <div className="HeaderActions">
            <button className="Button ButtonPrimary" onClick={openCreate}>
              New note
            </button>
          </div>
        </div>
      </header>

      <main className="Main">
        <div className="Container">
          {error ? (
            <div className="Alert" role="alert">
              <div className="AlertTitle">Something went wrong</div>
              <div className="AlertBody">{error}</div>
            </div>
          ) : null}

          <section className="Panel">
            <div className="PanelHeader">
              <div>
                <h1 className="H1">Your notes</h1>
                <p className="Muted">Stored locally by the backend (JSON persistence) so previews work without setup.</p>
              </div>
              <div className="PanelHeaderRight">
                <button className="Button ButtonSecondary" onClick={fetchNotes} disabled={loadingList}>
                  {loadingList ? 'Refreshing…' : 'Refresh'}
                </button>
              </div>
            </div>

            {loadingList ? (
              <div className="EmptyState">Loading notes…</div>
            ) : notes.length === 0 ? (
              <div className="EmptyState">
                <div className="EmptyTitle">No notes yet</div>
                <div className="EmptyBody">Create your first note to get started.</div>
                <button className="Button ButtonPrimary" onClick={openCreate}>
                  Create a note
                </button>
              </div>
            ) : (
              <ul className="NotesGrid" aria-label="Notes list">
                {notes.map((note) => (
                  <li key={note.id} className="NoteCard">
                    <div className="NoteCardTop">
                      <div className="NoteTitleRow">
                        <h2 className="NoteTitle">
                          {note.title}
                          {note._optimistic ? <span className="Pill">Saving…</span> : null}
                        </h2>
                      </div>
                      <div className="NoteMeta">
                        <span className="MutedSmall">Updated</span>{' '}
                        <span className="MonoSmall">
                          {note.updated_at ? new Date(note.updated_at).toLocaleString() : '—'}
                        </span>
                      </div>
                    </div>

                    <p className="NoteContent">{note.content || <span className="Muted">No content</span>}</p>

                    <div className="NoteActions">
                      <button className="Button ButtonSecondary" onClick={() => openEdit(note)} disabled={saving || deletingId}>
                        Edit
                      </button>
                      <button
                        className="Button ButtonDanger"
                        onClick={() => requestDelete(note)}
                        disabled={saving || deletingId === note.id}
                      >
                        {deletingId === note.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>

      {/* Form modal */}
      {isFormOpen ? (
        <div className="ModalOverlay" role="dialog" aria-modal="true" aria-label={isEditing ? 'Edit note' : 'New note'}>
          <div className="Modal">
            <div className="ModalHeader">
              <div>
                <div className="ModalTitle">{isEditing ? 'Edit note' : 'New note'}</div>
                <div className="ModalSubtitle">Title is required. Content is optional.</div>
              </div>
              <button className="IconButton" onClick={closeForm} aria-label="Close form">
                ×
              </button>
            </div>

            <form onSubmit={onSubmit} className="Form">
              <label className="Label">
                Title
                <input
                  className="Input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Meeting notes"
                  autoFocus
                  required
                  maxLength={200}
                />
              </label>

              <label className="Label">
                Content
                <textarea
                  className="Textarea"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write your note…"
                  rows={8}
                />
              </label>

              <div className="FormActions">
                <button type="button" className="Button ButtonSecondary" onClick={closeForm} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="Button ButtonPrimary" disabled={saving}>
                  {saving ? (isEditing ? 'Saving…' : 'Creating…') : isEditing ? 'Save changes' : 'Create note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Delete confirm modal */}
      {confirmDelete.open ? (
        <div className="ModalOverlay" role="dialog" aria-modal="true" aria-label="Confirm delete">
          <div className="Modal">
            <div className="ModalHeader">
              <div>
                <div className="ModalTitle">Delete note?</div>
                <div className="ModalSubtitle">This action cannot be undone.</div>
              </div>
              <button className="IconButton" onClick={closeDeleteConfirm} aria-label="Close delete confirmation">
                ×
              </button>
            </div>

            <div className="ConfirmBody">
              <div className="ConfirmNoteTitle">{confirmDelete.note?.title}</div>
              <div className="MutedSmall">Are you sure you want to delete this note?</div>
            </div>

            <div className="FormActions">
              <button type="button" className="Button ButtonSecondary" onClick={closeDeleteConfirm} disabled={Boolean(deletingId)}>
                Cancel
              </button>
              <button
                type="button"
                className="Button ButtonDanger"
                onClick={confirmDeleteNow}
                disabled={Boolean(deletingId)}
              >
                {deletingId ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default App;
