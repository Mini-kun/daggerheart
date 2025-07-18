export class DaggerheartMigrations {
  
  // Current version
  static CURRENT_VERSION = "1.2.0";
  
  // Run migrations
  static async migrateDocument(document) {
    let needsUpdate = false;
    const systemData = document.system;
    const currentVersion = document.getFlag('daggerheart', 'migrationVersion') || "1.0.0";
    
    // Check version
    if (this.compareVersions(currentVersion, this.CURRENT_VERSION) < 0) {
      console.log(`🔄 Migrating ${document.documentName} "${document.name}" from v${currentVersion} to v${this.CURRENT_VERSION}`);
      
      // Run updates
      if (this.compareVersions(currentVersion, "1.1.0") < 0) {
        needsUpdate = this._migrateToLocationBased(document) || needsUpdate;
      }
      
      if (this.compareVersions(currentVersion, "1.1.1") < 0) {
        needsUpdate = this._migrateWeaponEquipped(document) || needsUpdate;
      }
      
      if (this.compareVersions(currentVersion, "1.2.0") < 0 && document.documentName === "Actor") {
        const weaponMigration = this._migrateWeaponDataStructure(document);
        if (weaponMigration) {
          document.updateSource(weaponMigration);
          needsUpdate = true;
        }
      }
      
      if (this.compareVersions(currentVersion, "1.2.0") < 0 && document.documentName === "Item") {
        const weaponItemMigration = this._migrateWeaponItemDataStructure(document);
        if (weaponItemMigration) {
          document.updateSource(weaponItemMigration);
          needsUpdate = true;
        }
      }
      
      // Mark done
      if (needsUpdate) {
        await document.setFlag('daggerheart', 'migrationVersion', this.CURRENT_VERSION);
      }
    }
    
    return needsUpdate;
  }
  
  // Add locations
  static _migrateToLocationBased(document) {
    let needsUpdate = false;
    const updates = {};
    
    // Fix items without location
    if (document.documentName === "Item" && !document.system.location) {
      const location = this._getDefaultLocationForType(document.type);
      updates["system.location"] = location;
      needsUpdate = true;
      
      console.log(`📦 Setting location for ${document.type} "${document.name}" → "${location}"`);
    }
    

    
    // Apply updates
    if (needsUpdate && Object.keys(updates).length > 0) {
      document.updateSource(updates);
    }
    
    return needsUpdate;
  }
  
  // Add equipped
  static _migrateWeaponEquipped(document) {
    let needsUpdate = false;
    const updates = {};
    
    // Fix weapons without equipped
    if (document.documentName === "Item" && document.type === "weapon" && document.system.equipped === undefined) {
      updates["system.equipped"] = false;
      needsUpdate = true;
      
      console.log(`⚔️ Adding equipped field to weapon "${document.name}" → false`);
    }
    
    // Apply updates
    if (needsUpdate && Object.keys(updates).length > 0) {
      document.updateSource(updates);
    }
    
    return needsUpdate;
  }
  
  // Get location
  static _getDefaultLocationForType(type) {
    switch (type) {
      case "worn":
        return "worn";
      case "inventory":
        return "backpack";
      case "vault":
        return "vault";
      case "class":
        return "class";
      case "subclass":
        return "subclass";
      case "ancestry":
        return "ancestry";
      case "community":
        return "community";
      case "domain":
      case "item":
        return "abilities";
      case "weapon":
        return "backpack";
      default:
        console.warn(`Unknown item type "${type}", defaulting to backpack`);
        return "backpack";
    }
  }
  
  // Compare versions
  static compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const a = parts1[i] || 0;
      const b = parts2[i] || 0;
      
      if (a < b) return -1;
      if (a > b) return 1;
    }
    
    return 0;
  }
  
  // Migrate world
  static async migrateWorld() {
    console.log("🌍 Starting world migration...");
    
    const migrationPromises = [];
    
    // Fix actors
    for (const actor of game.actors) {
      migrationPromises.push(this.migrateDocument(actor));
      
      // Fix items
      for (const item of actor.items) {
        migrationPromises.push(this.migrateDocument(item));
      }
    }
    
    // Fix world items
    for (const item of game.items) {
      migrationPromises.push(this.migrateDocument(item));
    }
    
    // Wait for finish
    const results = await Promise.all(migrationPromises);
    const migratedCount = results.filter(Boolean).length;
    
    if (migratedCount > 0) {
      console.log(`✅ Migration complete! Updated ${migratedCount} documents.`);
      ui.notifications.info(`Migration complete! Updated ${migratedCount} items to new inventory system.`);
    } else {
      console.log("✅ No migration needed - all documents up to date.");
    }
  }

  /**
   * Migrate weapon data structures to new format
   * @param {Actor} actor 
   */
  static _migrateWeaponDataStructure(actor) {
    const updateData = {};
    let needsUpdate = false;

    // Migrate weapon-main damage structure
    if (actor.system["weapon-main"]?.damage) {
      const damage = actor.system["weapon-main"].damage;
      if (typeof damage === 'string' || typeof damage === 'number') {
        updateData["system.weapon-main.damage"] = {
          baseValue: damage || "1d8",
          modifiers: [],
          value: damage || "1d8"
        };
        needsUpdate = true;
      }
    }

    // Migrate weapon-main to-hit structure
    if (actor.system["weapon-main"]?.["to-hit"]) {
      const toHit = actor.system["weapon-main"]["to-hit"];
      if (typeof toHit === 'string' || typeof toHit === 'number') {
        updateData["system.weapon-main.to-hit"] = {
          baseValue: parseInt(toHit) || 0,
          modifiers: [],
          value: parseInt(toHit) || 0
        };
        needsUpdate = true;
      }
    }

    // Migrate weapon-off damage structure
    if (actor.system["weapon-off"]?.damage) {
      const damage = actor.system["weapon-off"].damage;
      if (typeof damage === 'string' || typeof damage === 'number') {
        updateData["system.weapon-off.damage"] = {
          baseValue: damage || "1d8",
          modifiers: [],
          value: damage || "1d8"
        };
        needsUpdate = true;
      }
    }

    // Migrate weapon-off to-hit structure
    if (actor.system["weapon-off"]?.["to-hit"]) {
      const toHit = actor.system["weapon-off"]["to-hit"];
      if (typeof toHit === 'string' || typeof toHit === 'number') {
        updateData["system.weapon-off.to-hit"] = {
          baseValue: parseInt(toHit) || 0,
          modifiers: [],
          value: parseInt(toHit) || 0
        };
        needsUpdate = true;
      }
    }

    return needsUpdate ? updateData : null;
  }

  /**
   * Migrate weapon item data structures to new format
   * @param {Item} item 
   */
  static _migrateWeaponItemDataStructure(item) {
    const updateData = {};
    let needsUpdate = false;

    if (item.type === "weapon") {
      // Migrate weapon damage structure
      if (item.system.damage) {
        const damage = item.system.damage;
        if (typeof damage === 'string' || typeof damage === 'number') {
          updateData["system.damage"] = {
            baseValue: damage || "1d8",
            modifiers: [],
            value: damage || "1d8"
          };
          needsUpdate = true;
          console.log(`⚔️ Migrating weapon "${item.name}" damage from "${damage}" to structured format`);
        }
      } else {
        // Weapon has no damage - set default structure
        updateData["system.damage"] = {
          baseValue: "1d8",
          modifiers: [],
          value: "1d8"
        };
        needsUpdate = true;
        console.log(`⚔️ Adding default damage structure to weapon "${item.name}"`);
      }
    }

    return needsUpdate ? updateData : null;
  }

  /**
   * Migrate to version 1.2.1 - Add weapon slot system
   * @param {Actor} actor
   * @private
   */
  static async _migrateToV121(actor) {
    console.log(`Daggerheart | Migrating ${actor.name} to v1.2.1 (weapon slots)`);
    
    const updateData = {};
    let hasChanges = false;
    
    // Migrate weapon items to include weaponSlot field
    for (let item of actor.items) {
      if (item.type === "weapon") {
        const itemUpdateData = {};
        
        // Add weaponSlot field if missing
        if (item.system.weaponSlot === undefined) {
          // If weapon is equipped but has no slot, assign to primary (first come, first served)
          if (item.system.equipped) {
            const equippedWeapons = actor.items.filter(i => 
              i.type === "weapon" && 
              i.system.equipped && 
              i.system.weaponSlot
            );
            
            // Assign to primary if no primary exists, otherwise secondary
            const hasPrimary = equippedWeapons.some(w => w.system.weaponSlot === "primary");
            const hasSecondary = equippedWeapons.some(w => w.system.weaponSlot === "secondary");
            
            if (!hasPrimary) {
              itemUpdateData["system.weaponSlot"] = "primary";
            } else if (!hasSecondary) {
              itemUpdateData["system.weaponSlot"] = "secondary";
            } else {
              // Both slots taken, unequip this weapon
              itemUpdateData["system.equipped"] = false;
              itemUpdateData["system.weaponSlot"] = null;
            }
          } else {
            itemUpdateData["system.weaponSlot"] = null;
          }
          
          // Apply item updates
          if (Object.keys(itemUpdateData).length > 0) {
            await item.update(itemUpdateData);
            console.log(`Daggerheart | Updated weapon ${item.name} with slot data:`, itemUpdateData);
          }
        }
      }
    }
    
    // Update system version
    updateData["system.version"] = "1.2.1";
    hasChanges = true;
    
    if (hasChanges) {
      await actor.update(updateData);
      console.log(`Daggerheart | ${actor.name} migrated to v1.2.1`);
    }
  }

  /**
   * Migrate a single actor to the latest version
   * @param {Actor} actor
   */
  static async migrateActor(actor) {
    const currentVersion = actor.system.version || "1.0.0";
    console.log(`Daggerheart | Checking migration for ${actor.name}, current version: ${currentVersion}`);
    
    // Version 1.2.0 migration - weapon data structure
    if (foundry.utils.isNewerVersion("1.2.0", currentVersion)) {
      await this._migrateToV120(actor);
    }
    
    // Version 1.2.1 migration - weapon slot system
    if (foundry.utils.isNewerVersion("1.2.1", currentVersion)) {
      await this._migrateToV121(actor);
    }
    
    console.log(`Daggerheart | Migration complete for ${actor.name}`);
  }
} 