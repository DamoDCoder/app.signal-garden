import type { ReactNode } from 'react';
import { explain } from '../api/errors.js';
import { useGarden, useGardenDispatch } from '../state/gardenStore.js';

export function ErrorBanner(): ReactNode {
  const { error } = useGarden();
  const dispatch = useGardenDispatch();
  if (error === undefined) return null;

  return (
    <div role="alert" className="error-banner">
      <span>{explain(error)}</span>
      <button type="button" onClick={() => dispatch({ type: 'error/cleared' })}>
        dismiss
      </button>
    </div>
  );
}
