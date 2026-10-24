import { Schema, model } from 'mongoose'

export type IDailyAllocation = {
  company: Schema.Types.ObjectId
  employee: Schema.Types.ObjectId
  project: Schema.Types.ObjectId
  date: string
  hours: number
}

const dailyAllocationSchema = new Schema<IDailyAllocation>(
  {
    company: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    employee: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    date: { type: String, required: true },
    hours: { type: Number, required: true },
  },
  { timestamps: true },
)

dailyAllocationSchema.index({ employee: 1, project: 1, date: 1 }, { unique: true })

export const DailyAllocation = model<IDailyAllocation>('DailyAllocation', dailyAllocationSchema)
