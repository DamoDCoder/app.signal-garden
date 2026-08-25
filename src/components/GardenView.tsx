/**
 * The garden as the processor says it is.
 *
 * Every value here comes from a snapshot. Nothing is interpolated, smoothed, or
 * predicted between frames: the processor is the authority for garden state, and
 * a client that guessed at the ticks in between would be showing a garden that
 * does not exist.
 */

import type { CSSProperties, ReactNode } from 'react';
import type { Organism } from '../gen/signal/garden/v1/garden_pb.js';
import { maxHealth, maxMoisture, maxStage } from '../api/limits.js';
import { num } from '../api/json.js';
import { useGarden } from '../state/gardenStore.js';

export function GardenView(): ReactNode {
  const { snapshot } = useGarden();

  if (snapshot === undefined) {
    return (
      <section className="panel garden-view">
        <h2>Garden</h2>
        <p className="empty">Waiting for the first frame.</p>
      </section>
    );
  }

  const stats = snapshot.stats;

  return (
    <section className="panel garden-view">
      <h2>
        Garden <small data-testid="garden-tick">tick {num(snapshot.tick)}</small>
      </h2>

      {stats !== undefined && (
        <dl className="garden-stats">
          <Stat name="alive" value={`${stats.alive} / ${stats.organisms}`} />
          <Stat name="moisture" value={stats.averageMoisture.toFixed(1)} />
          <Stat name="health" value={stats.averageHealth.toFixed(1)} />
          <Stat name="stage" value={stats.averageStage.toFixed(2)} />
          <Stat name="total stage" value={String(stats.totalStage)} />
        </dl>
      )}

      <ul className="organisms" data-testid="organisms">
        {snapshot.organisms.map((organism) => (
          <OrganismCell key={organism.id} organism={organism} />
        ))}
      </ul>

      {/* The hash is what makes replay checkable: two runs with the same seed
          and the same control ticks reach the same one. It is shown because it
          is the claim this project is making, not as decoration. */}
      <p className="garden-hash" title="fingerprint of this garden">
        {snapshot.hash}
      </p>
    </section>
  );
}

function Stat({ name, value }: { name: string; value: string }): ReactNode {
  return (
    <div className="stat">
      <dt>{name}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function OrganismCell({ organism }: { organism: Organism }): ReactNode {
  const dead = organism.health <= 0;
  return (
    <li
      className="organism"
      data-dead={dead}
      title={`${organism.id} · health ${organism.health} · moisture ${organism.moisture} · stage ${organism.stage}`}
      style={
        {
          // Stage drives size, health drives colour, moisture drives the ring.
          // Three channels for three values, so a glance separates a thirsty
          // garden from a sick one rather than averaging them into one blob.
          '--stage': organism.stage / maxStage,
          '--health': organism.health / maxHealth,
          '--moisture': organism.moisture / maxMoisture,
        } as CSSProperties
      }
    />
  );
}
