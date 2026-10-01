/**
 * Purple Bean Gaming — Dota State Persistence Manager
 */

export class DotaStatePersistenceManager {
  public async persistState(key: string, data: any): Promise<boolean> {
    return true;
  }

  public async restoreState(key: string): Promise<any | null> {
    return null;
  }
}

export const dotaStatePersistenceManager = new DotaStatePersistenceManager();
