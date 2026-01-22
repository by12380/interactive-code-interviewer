import { memo, useState, useMemo, useCallback } from "react";
import {
  ACHIEVEMENTS,
  calculateLevel,
  getLevelProgress,
  xpForLevel,
  getAchievementsWithStatus,
  getFriendsWithStats
} from "../services/gamificationService.js";
import { addFriend, removeFriend } from "../services/userService.js";

function GamificationPanel({ 
  user, 
  onClose,
  onUserUpdate
}) {
  const [activeTab, setActiveTab] = useState("overview");
  const [friendCode, setFriendCode] = useState("");
  const [friendError, setFriendError] = useState("");
  const [friendSuccess, setFriendSuccess] = useState("");

  const gamification = user?.gamification || {};
  const xp = gamification.xp || 0;
  const level = calculateLevel(xp);
  const levelProgress = getLevelProgress(xp);
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const xpToNextLevel = nextLevelXp - xp;
  
  const streak = gamification.streak || { current: 0, longest: 0 };
  const achievements = useMemo(
    () => getAchievementsWithStatus(gamification.achievements || []),
    [gamification.achievements]
  );
  
  const earnedCount = achievements.filter(a => a.earned).length;
  const totalCount = achievements.length;
  
  const friendsWithStats = useMemo(
    () => getFriendsWithStats(gamification.friends || []),
    [gamification.friends]
  );

  const myFriendCode = gamification.friendCode || "------";

  const handleAddFriend = useCallback(() => {
    setFriendError("");
    setFriendSuccess("");
    
    if (!friendCode.trim()) {
      setFriendError("Please enter a friend code.");
      return;
    }
    
    const result = addFriend(friendCode.trim());
    
    if (result.success) {
      setFriendSuccess(`Added ${result.friend?.username || 'friend'} successfully!`);
      setFriendCode("");
      if (onUserUpdate) {
        onUserUpdate(result.user);
      }
    } else {
      setFriendError(result.error || "Failed to add friend.");
    }
  }, [friendCode, onUserUpdate]);

  const handleRemoveFriend = useCallback((code) => {
    const result = removeFriend(code);
    if (result.success && onUserUpdate) {
      onUserUpdate(result.user);
    }
  }, [onUserUpdate]);

  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(myFriendCode);
    setFriendSuccess("Friend code copied!");
    setTimeout(() => setFriendSuccess(""), 2000);
  }, [myFriendCode]);

  const rarityColors = {
    common: "#94a3b8",
    uncommon: "#22c55e",
    rare: "#3b82f6",
    legendary: "#f59e0b"
  };

  return (
    <div className="gamification-modal">
      <div className="gamification-modal__backdrop" onClick={onClose} />
      <div className="gamification-modal__content">
        <button 
          className="gamification-modal__close" 
          onClick={onClose}
          aria-label="Close gamification panel"
        >
          ×
        </button>

        <div className="gamification__header">
          <h2 className="gamification__title">Your Progress</h2>
          <div className="gamification__level-badge">
            <span className="gamification__level-number">Lv.{level}</span>
          </div>
        </div>

        <div className="gamification__tabs">
          <button
            className={`gamification__tab ${activeTab === "overview" ? "gamification__tab--active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            Overview
          </button>
          <button
            className={`gamification__tab ${activeTab === "achievements" ? "gamification__tab--active" : ""}`}
            onClick={() => setActiveTab("achievements")}
          >
            Achievements
          </button>
          <button
            className={`gamification__tab ${activeTab === "friends" ? "gamification__tab--active" : ""}`}
            onClick={() => setActiveTab("friends")}
          >
            Friends
          </button>
        </div>

        <div className="gamification__content">
          {activeTab === "overview" && (
            <div className="gamification__overview">
              {/* XP Progress */}
              <div className="gamification__xp-section">
                <div className="gamification__xp-header">
                  <span className="gamification__xp-label">Experience Points</span>
                  <span className="gamification__xp-value">{xp.toLocaleString()} XP</span>
                </div>
                <div className="gamification__xp-bar">
                  <div 
                    className="gamification__xp-fill"
                    style={{ width: `${levelProgress}%` }}
                  />
                </div>
                <div className="gamification__xp-details">
                  <span>Level {level}</span>
                  <span>{xpToNextLevel.toLocaleString()} XP to Level {level + 1}</span>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="gamification__stats-grid">
                <div className="gamification__stat-card">
                  <span className="gamification__stat-icon">🔥</span>
                  <span className="gamification__stat-value">{streak.current}</span>
                  <span className="gamification__stat-label">Day Streak</span>
                </div>
                <div className="gamification__stat-card">
                  <span className="gamification__stat-icon">🏆</span>
                  <span className="gamification__stat-value">{streak.longest}</span>
                  <span className="gamification__stat-label">Best Streak</span>
                </div>
                <div className="gamification__stat-card">
                  <span className="gamification__stat-icon">🎖️</span>
                  <span className="gamification__stat-value">{earnedCount}/{totalCount}</span>
                  <span className="gamification__stat-label">Achievements</span>
                </div>
                <div className="gamification__stat-card">
                  <span className="gamification__stat-icon">👥</span>
                  <span className="gamification__stat-value">{friendsWithStats.length}</span>
                  <span className="gamification__stat-label">Friends</span>
                </div>
              </div>

              {/* Recent Achievements */}
              <div className="gamification__recent-section">
                <h3>Recent Achievements</h3>
                <div className="gamification__recent-achievements">
                  {achievements.filter(a => a.earned).slice(0, 3).length > 0 ? (
                    achievements.filter(a => a.earned).slice(0, 3).map(achievement => (
                      <div key={achievement.id} className="gamification__achievement-mini">
                        <span className="gamification__achievement-icon">{achievement.icon}</span>
                        <span className="gamification__achievement-name">{achievement.name}</span>
                      </div>
                    ))
                  ) : (
                    <p className="gamification__no-achievements">
                      Complete problems to earn achievements!
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "achievements" && (
            <div className="gamification__achievements">
              <div className="gamification__achievements-progress">
                <span>{earnedCount} of {totalCount} achievements unlocked</span>
                <div className="gamification__achievements-bar">
                  <div 
                    className="gamification__achievements-fill"
                    style={{ width: `${(earnedCount / totalCount) * 100}%` }}
                  />
                </div>
              </div>
              
              <div className="gamification__achievements-grid">
                {achievements.map(achievement => (
                  <div 
                    key={achievement.id}
                    className={`gamification__achievement-card ${achievement.earned ? "gamification__achievement-card--earned" : "gamification__achievement-card--locked"}`}
                  >
                    <div 
                      className="gamification__achievement-badge"
                      style={{ 
                        borderColor: achievement.earned ? rarityColors[achievement.rarity] : "#e2e8f0",
                        opacity: achievement.earned ? 1 : 0.5
                      }}
                    >
                      <span className="gamification__achievement-icon-large">
                        {achievement.earned ? achievement.icon : "🔒"}
                      </span>
                    </div>
                    <div className="gamification__achievement-info">
                      <span className="gamification__achievement-title">{achievement.name}</span>
                      <span className="gamification__achievement-desc">{achievement.description}</span>
                      <span 
                        className="gamification__achievement-rarity"
                        style={{ color: rarityColors[achievement.rarity] }}
                      >
                        {achievement.rarity.charAt(0).toUpperCase() + achievement.rarity.slice(1)} • +{achievement.xpReward} XP
                      </span>
                    </div>
                    {achievement.earned && (
                      <span className="gamification__achievement-check">✓</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "friends" && (
            <div className="gamification__friends">
              {/* Your Friend Code */}
              <div className="gamification__friend-code-section">
                <h3>Your Friend Code</h3>
                <div className="gamification__friend-code-display">
                  <span className="gamification__friend-code">{myFriendCode}</span>
                  <button 
                    className="gamification__copy-btn"
                    onClick={handleCopyCode}
                    aria-label="Copy friend code"
                  >
                    📋 Copy
                  </button>
                </div>
                <p className="gamification__friend-code-hint">
                  Share this code with friends to compare progress
                </p>
              </div>

              {/* Add Friend */}
              <div className="gamification__add-friend-section">
                <h3>Add Friend</h3>
                <div className="gamification__add-friend-form">
                  <input
                    type="text"
                    className="gamification__friend-input"
                    placeholder="Enter friend code..."
                    value={friendCode}
                    onChange={(e) => setFriendCode(e.target.value.toUpperCase())}
                    maxLength={6}
                  />
                  <button 
                    className="gamification__add-friend-btn"
                    onClick={handleAddFriend}
                  >
                    Add Friend
                  </button>
                </div>
                {friendError && (
                  <p className="gamification__friend-error">{friendError}</p>
                )}
                {friendSuccess && (
                  <p className="gamification__friend-success">{friendSuccess}</p>
                )}
              </div>

              {/* Friends List */}
              <div className="gamification__friends-list-section">
                <h3>Friends ({friendsWithStats.length})</h3>
                {friendsWithStats.length === 0 ? (
                  <div className="gamification__no-friends">
                    <p>No friends added yet.</p>
                    <p className="gamification__no-friends-hint">
                      Add friends using their friend code to compare progress!
                    </p>
                  </div>
                ) : (
                  <div className="gamification__friends-list">
                    {friendsWithStats.map((friend, index) => (
                      <div key={friend.code} className="gamification__friend-item">
                        <span className="gamification__friend-rank">#{index + 1}</span>
                        <div className="gamification__friend-avatar">
                          {friend.username?.charAt(0).toUpperCase() || "?"}
                        </div>
                        <div className="gamification__friend-info">
                          <span className="gamification__friend-name">
                            {friend.username}
                            {!friend.found && " (not found)"}
                          </span>
                          <span className="gamification__friend-stats">
                            Lv.{friend.level} • {friend.xp.toLocaleString()} XP • {friend.problemsCompleted} solved
                          </span>
                        </div>
                        <button
                          className="gamification__remove-friend-btn"
                          onClick={() => handleRemoveFriend(friend.code)}
                          aria-label={`Remove ${friend.username}`}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Your Rank Among Friends */}
              {friendsWithStats.length > 0 && (
                <div className="gamification__your-rank-section">
                  <h3>Your Rank</h3>
                  <div className="gamification__your-rank">
                    <span className="gamification__your-rank-position">
                      {(() => {
                        const allUsers = [
                          { username: user.username, xp, level, problemsCompleted: user.stats?.problemsCompleted?.length || 0, isYou: true },
                          ...friendsWithStats.map(f => ({ ...f, isYou: false }))
                        ].sort((a, b) => b.xp - a.xp);
                        const yourRank = allUsers.findIndex(u => u.isYou) + 1;
                        return `#${yourRank} of ${allUsers.length}`;
                      })()}
                    </span>
                    <span className="gamification__your-rank-label">among your friends</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(GamificationPanel);
