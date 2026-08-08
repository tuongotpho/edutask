import { ClassGroup, PeriodConfig, Room } from '@/Edu-task/types/schedule';
import { genId } from '@/Edu-task/lib/utils';
import { currentSchoolId } from '@/Edu-task/lib/tenant';
import { firebaseService } from '@/Edu-task/services/firebaseService';
import { ToastKind } from '@/Edu-task/components/common/Toast';

/**
 * Rooms, classes and the period timetable — the catalogs every scheduling
 * feature picks from.
 *
 * Same optimistic-then-rollback contract as the rest of the app: the UI updates
 * immediately, the write is awaited, and a rejection restores the previous
 * state and says so. Without the rollback a rules rejection looks exactly like
 * success until the next snapshot silently removes the row.
 *
 * Unlike departments these are NOT mirrored into localStorage. Departments are
 * needed on the login screen before any subscription exists; rooms and classes
 * are only ever used inside forms the user reaches after data has loaded, so a
 * local copy would be one more thing to keep in sync for no benefit.
 */

interface CatalogLogicProps {
  rooms: Room[];
  setRooms: React.Dispatch<React.SetStateAction<Room[]>>;
  classes: ClassGroup[];
  setClasses: React.Dispatch<React.SetStateAction<ClassGroup[]>>;
  periodConfig: PeriodConfig;
  setPeriodConfig: React.Dispatch<React.SetStateAction<PeriodConfig>>;
  notify: (kind: ToastKind, text: string) => void;
}

const SAVE_FAILED = 'Không lưu được thay đổi lên máy chủ. Thay đổi đã được hoàn tác.';

export type RoomInput = Omit<Room, 'id' | 'schoolId'>;
export type ClassInput = Omit<ClassGroup, 'id' | 'schoolId'>;

export function useCatalogLogic({
  rooms, setRooms,
  classes, setClasses,
  periodConfig, setPeriodConfig,
  notify,
}: CatalogLogicProps) {

  // --- Rooms ---------------------------------------------------------------

  const addRoom = async (data: RoomInput): Promise<boolean> => {
    const code = data.code.trim().toUpperCase().replace(/\s+/g, '-');
    if (rooms.some(r => r.code === code)) {
      notify('error', `Mã phòng "${code}" đã tồn tại.`);
      return false;
    }

    const room: Room = { ...data, id: genId('ROOM'), schoolId: currentSchoolId(), code };
    const previous = rooms;
    setRooms([...rooms, room]);

    try {
      await firebaseService.saveRoom(room);
      return true;
    } catch (err) {
      console.error('Failed to add room:', err);
      setRooms(previous);
      notify('error', SAVE_FAILED);
      return false;
    }
  };

  const updateRoom = async (id: string, data: RoomInput): Promise<boolean> => {
    const target = rooms.find(r => r.id === id);
    if (!target) return false;

    const code = data.code.trim().toUpperCase().replace(/\s+/g, '-');
    if (rooms.some(r => r.id !== id && r.code === code)) {
      notify('error', `Mã phòng "${code}" đã tồn tại.`);
      return false;
    }

    const updated: Room = { ...target, ...data, code };
    const previous = rooms;
    setRooms(rooms.map(r => (r.id === id ? updated : r)));

    try {
      await firebaseService.saveRoom(updated);
      return true;
    } catch (err) {
      console.error('Failed to update room:', err);
      setRooms(previous);
      notify('error', SAVE_FAILED);
      return false;
    }
  };

  /**
   * Deleting a room that bookings still reference would leave those bookings
   * pointing at nothing, so the caller passes the count it can see. Deactivating
   * is the right move for a room that is out of service but has history —
   * `isActive: false` keeps it out of the pickers without breaking the past.
   */
  const deleteRoom = async (id: string, referencingBookings = 0): Promise<boolean> => {
    if (referencingBookings > 0) {
      notify(
        'error',
        `Không thể xóa: vẫn còn ${referencingBookings} lượt đăng ký phòng này. Hãy chuyển phòng sang trạng thái "Ngừng sử dụng" thay vì xóa.`
      );
      return false;
    }

    const previous = rooms;
    setRooms(rooms.filter(r => r.id !== id));

    try {
      await firebaseService.deleteRoom(id);
      return true;
    } catch (err) {
      console.error('Failed to delete room:', err);
      setRooms(previous);
      notify('error', SAVE_FAILED);
      return false;
    }
  };

  // --- Classes -------------------------------------------------------------

  const addClass = async (data: ClassInput): Promise<boolean> => {
    const name = data.name.trim();
    if (classes.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      notify('error', `Lớp "${name}" đã tồn tại.`);
      return false;
    }

    const classGroup: ClassGroup = { ...data, id: genId('CLASS'), schoolId: currentSchoolId(), name };
    const previous = classes;
    setClasses([...classes, classGroup]);

    try {
      await firebaseService.saveClass(classGroup);
      return true;
    } catch (err) {
      console.error('Failed to add class:', err);
      setClasses(previous);
      notify('error', SAVE_FAILED);
      return false;
    }
  };

  const updateClass = async (id: string, data: ClassInput): Promise<boolean> => {
    const target = classes.find(c => c.id === id);
    if (!target) return false;

    const name = data.name.trim();
    if (classes.some(c => c.id !== id && c.name.toLowerCase() === name.toLowerCase())) {
      notify('error', `Lớp "${name}" đã tồn tại.`);
      return false;
    }

    const updated: ClassGroup = { ...target, ...data, name };
    const previous = classes;
    setClasses(classes.map(c => (c.id === id ? updated : c)));

    try {
      await firebaseService.saveClass(updated);
      return true;
    } catch (err) {
      console.error('Failed to update class:', err);
      setClasses(previous);
      notify('error', SAVE_FAILED);
      return false;
    }
  };

  const deleteClass = async (id: string, referencingRecords = 0): Promise<boolean> => {
    if (referencingRecords > 0) {
      notify(
        'error',
        `Không thể xóa: vẫn còn ${referencingRecords} bản ghi tham chiếu lớp này. Hãy chuyển lớp sang trạng thái "Không còn hoạt động".`
      );
      return false;
    }

    const previous = classes;
    setClasses(classes.filter(c => c.id !== id));

    try {
      await firebaseService.deleteClass(id);
      return true;
    } catch (err) {
      console.error('Failed to delete class:', err);
      setClasses(previous);
      notify('error', SAVE_FAILED);
      return false;
    }
  };

  // --- Period timetable ----------------------------------------------------

  const updatePeriodConfig = async (config: PeriodConfig): Promise<boolean> => {
    const previous = periodConfig;
    setPeriodConfig(config);

    try {
      await firebaseService.savePeriodConfig(config);
      return true;
    } catch (err) {
      console.error('Failed to save period config:', err);
      setPeriodConfig(previous);
      notify('error', SAVE_FAILED);
      return false;
    }
  };

  return {
    addRoom, updateRoom, deleteRoom,
    addClass, updateClass, deleteClass,
    updatePeriodConfig,
  };
}
