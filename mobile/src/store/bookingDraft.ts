import { create } from 'zustand';
import type {
  Address,
  CleaningType,
  CollectionSize,
  PropertySize,
  PropertyType,
  ServiceType,
  WasteType,
} from '../api/types';

/**
 * The in-progress booking, held across the multi-step flow.
 *
 * Deliberately NOT persisted: a half-finished draft restored days later would
 * carry a stale date and a stale price. Each booking starts clean from Home.
 */

interface BookingDraft {
  serviceType: ServiceType;
  address: Address | null;

  // Waste
  wasteTypes: WasteType[];
  collectionSize: CollectionSize | null;

  // Cleaning
  cleaningType: CleaningType | null;
  propertyType: PropertyType | null;
  propertySize: PropertySize | null;
  numberOfRooms: number | null;

  scheduledDate: string | null;
  timeSlotId: string | null;
  notes: string;

  start: (serviceType: ServiceType) => void;
  setAddress: (address: Address) => void;
  toggleWasteType: (type: WasteType) => void;
  setCollectionSize: (size: CollectionSize) => void;
  setCleaning: (input: {
    cleaningType?: CleaningType;
    propertyType?: PropertyType;
    propertySize?: PropertySize;
    numberOfRooms?: number;
  }) => void;
  setSchedule: (date: string, timeSlotId: string) => void;
  setNotes: (notes: string) => void;
  reset: () => void;
}

const empty = {
  serviceType: 'WASTE_COLLECTION' as ServiceType,
  address: null,
  wasteTypes: [] as WasteType[],
  collectionSize: null,
  cleaningType: null,
  propertyType: null,
  propertySize: null,
  numberOfRooms: null,
  scheduledDate: null,
  timeSlotId: null,
  notes: '',
};

export const useBookingDraft = create<BookingDraft>((set) => ({
  ...empty,

  start: (serviceType) => set({ ...empty, serviceType }),

  setAddress: (address) => set({ address }),

  /** Multiple categories are allowed on one pickup (ui.md §15). */
  toggleWasteType: (type) =>
    set((state) => ({
      wasteTypes: state.wasteTypes.includes(type)
        ? state.wasteTypes.filter((t) => t !== type)
        : [...state.wasteTypes, type],
    })),

  setCollectionSize: (collectionSize) => set({ collectionSize }),

  setCleaning: (input) => set((state) => ({ ...state, ...input })),

  setSchedule: (scheduledDate, timeSlotId) => set({ scheduledDate, timeSlotId }),

  setNotes: (notes) => set({ notes }),

  reset: () => set(empty),
}));

/** True once the draft has everything the create-booking endpoint requires. */
export const isDraftComplete = (draft: BookingDraft): boolean => {
  if (!draft.address || !draft.scheduledDate || !draft.timeSlotId) return false;

  return draft.serviceType === 'WASTE_COLLECTION'
    ? draft.wasteTypes.length > 0 && draft.collectionSize !== null
    : draft.cleaningType !== null && draft.propertyType !== null && draft.propertySize !== null;
};
