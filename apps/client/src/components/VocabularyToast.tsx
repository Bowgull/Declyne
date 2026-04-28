import { useState, useEffect } from 'react';
import {
  getVocabularyToast,
  clearVocabularyToast,
  subscribeVocabularyToast,
} from '../lib/vocabularyToast';

export default function VocabularyToast() {
  const [toast, setToast] = useState(getVocabularyToast);
  useEffect(() => subscribeVocabularyToast(() => setToast(getVocabularyToast())), []);
  if (!toast) return null;
  return (
    <div className="vocab-toast" role="status" onClick={clearVocabularyToast}>
      <span className="vocab-toast-text">{toast.message}</span>
      <span className="vocab-toast-dismiss" aria-hidden>
        ×
      </span>
    </div>
  );
}
