import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

crons.interval('trim old activity', { hours: 1 }, internal.activity.trim, {})

export default crons
