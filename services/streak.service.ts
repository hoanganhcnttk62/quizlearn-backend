import { v4 as uuidv4 } from "uuid";
import User from "../models/user";
import UserStreak from "../models/userStreak";

export const RESTORE_STREAK_COST = 50; // 50 XP points to restore 1 missed day

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateOnlyString(date: Date): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function diffCalendarDays(earlier: Date, later: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round(
    (startOfDay(later).getTime() - startOfDay(earlier).getTime()) / msPerDay
  );
}

/**
 * Get synchronized streak status for a user.
 * Automatically expires streaks if more than 1 day was missed (diffDays > 2).
 * Flags `canRestore: true` ONLY when exactly 1 day was missed (diffDays === 2).
 */
export async function getUserStreakStatus(userId: string) {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error("User not found");
  }

  const today = new Date();
  const diffDays = user.lastStreakDate
    ? diffCalendarDays(new Date(user.lastStreakDate), today)
    : null;

  let currentStreak = user.currentStreak || 0;
  let canRestore = false;
  let recoverableStreak = 0;

  // Missed MORE than 1 day (diffDays > 2): streak is permanently broken, cannot restore
  if (currentStreak > 0 && diffDays !== null && diffDays > 2) {
    const closeDate = toDateOnlyString(new Date(user.lastStreakDate));
    await UserStreak.update(
      { isActive: false, endDate: closeDate as any },
      { where: { userId, isActive: true } }
    );
    await User.update({ currentStreak: 0 }, { where: { id: userId } });
    currentStreak = 0;
  } else if (currentStreak > 0 && diffDays === 2) {
    // Missed EXACTLY 1 day (yesterday): eligible to restore with points!
    canRestore = true;
    recoverableStreak = currentStreak;
  }

  const streaks = await UserStreak.findAll({
    where: { userId },
    order: [["startDate", "DESC"]],
  });

  return {
    streak: streaks,
    currentStreak,
    longestStreak: user.longestStreak || 0,
    lastStreakDate: user.lastStreakDate,
    canRestore,
    restoreCost: RESTORE_STREAK_COST,
    recoverableStreak,
    experiencePoints: user.experiencePoints || 0,
  };
}

/**
 * Record a completed study session (Learn, Flashcard, Write, or Test)
 * and synchronize BOTH `Users` and `UserStreaks`.
 */
export async function recordStudyCompletion(userId: string) {
  const user = await User.findByPk(userId);
  if (!user) {
    return { isNewStreak: false, newStreakCount: 0 };
  }

  const today = new Date();
  const todayStr = toDateOnlyString(today);
  const diffDays = user.lastStreakDate
    ? diffCalendarDays(new Date(user.lastStreakDate), today)
    : null;

  // Case 1: Already earned streak today -> keep current streak
  if (user.currentStreak > 0 && diffDays === 0) {
    // Ensure there is an active UserStreak row in sync
    const activeRow = await UserStreak.findOne({
      where: { userId, isActive: true },
      order: [["startDate", "DESC"]],
    });
    if (!activeRow) {
      await UserStreak.create({
        id: uuidv4(),
        userId,
        startDate: todayStr as any,
        endDate: todayStr as any,
        streakLength: user.currentStreak,
        isActive: true,
      });
    }
    return { isNewStreak: false, newStreakCount: user.currentStreak };
  }

  // Case 2: Consecutive day (last studied yesterday, diffDays === 1)
  if (user.currentStreak > 0 && diffDays === 1) {
    const newStreakCount = user.currentStreak + 1;
    const newLongest = Math.max(user.longestStreak || 0, newStreakCount);

    await User.update(
      {
        currentStreak: newStreakCount,
        longestStreak: newLongest,
        lastStreakDate: today,
      },
      { where: { id: userId } }
    );

    const activeRow = await UserStreak.findOne({
      where: { userId, isActive: true },
      order: [["startDate", "DESC"]],
    });

    if (activeRow) {
      await activeRow.update({
        streakLength: newStreakCount,
        endDate: todayStr as any,
        isActive: true,
      });
    } else {
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - (newStreakCount - 1));
      await UserStreak.create({
        id: uuidv4(),
        userId,
        startDate: toDateOnlyString(startDate) as any,
        endDate: todayStr as any,
        streakLength: newStreakCount,
        isActive: true,
      });
    }

    return { isNewStreak: true, newStreakCount };
  }

  // Case 3: First time studying OR missed >= 1 day without restoring -> reset to 1
  if (user.lastStreakDate) {
    const closeDate = toDateOnlyString(new Date(user.lastStreakDate));
    await UserStreak.update(
      { isActive: false, endDate: closeDate as any },
      { where: { userId, isActive: true } }
    );
  } else {
    await UserStreak.update(
      { isActive: false },
      { where: { userId, isActive: true } }
    );
  }

  const newStreakCount = 1;
  const newLongest = Math.max(user.longestStreak || 0, 1);

  await User.update(
    {
      currentStreak: newStreakCount,
      longestStreak: newLongest,
      lastStreakDate: today,
    },
    { where: { id: userId } }
  );

  await UserStreak.create({
    id: uuidv4(),
    userId,
    startDate: todayStr as any,
    endDate: todayStr as any,
    streakLength: 1,
    isActive: true,
  });

  return { isNewStreak: true, newStreakCount };
}

/**
 * Restore a streak using XP points.
 * Allowed ONLY when user missed exactly 1 day (diffDays === 2).
 * More than 1 missed day (diffDays > 2) is strictly rejected.
 */
export async function restoreMissedStreak(userId: string) {
  const user = await User.findByPk(userId);
  if (!user) {
    throw { statusCode: 404, message: "Không tìm thấy người dùng." };
  }

  if (!user.lastStreakDate || (user.currentStreak || 0) <= 0) {
    throw { statusCode: 400, message: "Bạn chưa có chuỗi streak nào để khôi phục." };
  }

  const today = new Date();
  const diffDays = diffCalendarDays(new Date(user.lastStreakDate), today);

  if (diffDays <= 1) {
    throw {
      statusCode: 400,
      message: "Chuỗi streak của bạn vẫn đang hoạt động, không cần khôi phục.",
    };
  }

  if (diffDays > 2) {
    // Permanently close expired streak
    const closeDate = toDateOnlyString(new Date(user.lastStreakDate));
    await UserStreak.update(
      { isActive: false, endDate: closeDate as any },
      { where: { userId, isActive: true } }
    );
    await User.update({ currentStreak: 0 }, { where: { id: userId } });

    throw {
      statusCode: 400,
      message: "Bạn đã bỏ lỡ hơn 1 ngày nên không thể khôi phục chuỗi streak này.",
    };
  }

  // Exactly 1 missed day (diffDays === 2) -> check XP points
  if ((user.experiencePoints || 0) < RESTORE_STREAK_COST) {
    throw {
      statusCode: 400,
      message: `Bạn cần ít nhất ${RESTORE_STREAK_COST} điểm XP để khôi phục chuỗi streak (hiện có ${user.experiencePoints || 0} XP).`,
    };
  }

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = toDateOnlyString(yesterday);

  const newExp = user.experiencePoints - RESTORE_STREAK_COST;

  await User.update(
    {
      experiencePoints: newExp,
      lastStreakDate: yesterday,
    },
    { where: { id: userId } }
  );

  const activeRow = await UserStreak.findOne({
    where: { userId, isActive: true },
    order: [["startDate", "DESC"]],
  });

  if (activeRow) {
    await activeRow.update({
      endDate: yesterdayStr as any,
      isActive: true,
    });
  } else {
    const startDate = new Date(yesterday);
    startDate.setDate(startDate.getDate() - (user.currentStreak - 1));
    await UserStreak.create({
      id: uuidv4(),
      userId,
      startDate: toDateOnlyString(startDate) as any,
      endDate: yesterdayStr as any,
      streakLength: user.currentStreak,
      isActive: true,
    });
  }

  return getUserStreakStatus(userId);
}
