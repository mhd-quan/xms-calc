import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import type { QuoteSnapshot } from '../shared/types';

export class HistoryService {
  private cachePath: string;
  private maxSteps: number;

  private history: string[] = []; // Store serialized JSON strings to save memory/avoid references
  private currentIndex: number = -1;
  private persistQueue: Promise<void> = Promise.resolve();

  constructor(maxSteps: number = 30) {
    this.maxSteps = maxSteps;
    this.cachePath = path.join(app.getPath('userData'), 'history-cache.json');
  }

  public async initialize(): Promise<void> {
    await this.clear();
  }

  public async clear(): Promise<void> {
    this.history = [];
    this.currentIndex = -1;
    await this.persist();
  }

  public async push(snapshot: QuoteSnapshot): Promise<void> {
    const serialized = JSON.stringify(snapshot);

    // If the new snapshot is identical to the current one, do nothing
    if (this.currentIndex >= 0 && this.history[this.currentIndex] === serialized) {
      return;
    }

    // Drop any future states if we are not at the end of the history
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }

    this.history.push(serialized);

    // Enforce max steps
    if (this.history.length > this.maxSteps) {
      this.history.shift();
    } else {
      this.currentIndex++;
    }

    await this.persist();
  }

  public async undo(): Promise<QuoteSnapshot | null> {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      const serialized = this.history[this.currentIndex];
      if (!serialized) return null;
      const snapshot = JSON.parse(serialized) as QuoteSnapshot;
      await this.persist();
      return snapshot;
    }
    return null;
  }

  public async redo(): Promise<QuoteSnapshot | null> {
    if (this.currentIndex < this.history.length - 1) {
      this.currentIndex++;
      const serialized = this.history[this.currentIndex];
      if (!serialized) return null;
      const snapshot = JSON.parse(serialized) as QuoteSnapshot;
      await this.persist();
      return snapshot;
    }
    return null;
  }

  private async persist(): Promise<void> {
    const data = JSON.stringify({
      currentIndex: this.currentIndex,
      history: this.history
    });
    this.persistQueue = this.persistQueue
      .catch(() => undefined)
      .then(() => fs.writeFile(this.cachePath, data, 'utf-8'))
      .catch((err) => {
        console.error('Failed to persist history cache', err);
      });
    await this.persistQueue;
  }
}
