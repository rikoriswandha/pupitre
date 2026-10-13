import {
  HealthChecks,
  DiskSpaceCheck,
  MemoryHeapCheck,
  MemoryRSSCheck,
} from '@adonisjs/core/health'
import { DbCheck } from '@adonisjs/lucid/database'
import db from '@adonisjs/lucid/services/db'

// Checks are intentionally uncached: the plugin owns the TTL and forced refresh.
export default new HealthChecks().register([
  new DiskSpaceCheck().warnWhenExceeds(85).failWhenExceeds(95),
  new MemoryHeapCheck().warnWhenExceeds('512 mb').failWhenExceeds('1 gb'),
  new MemoryRSSCheck().warnWhenExceeds('1 gb').failWhenExceeds('2 gb'),
  new DbCheck(db.connection()),
])
