# Seasons

Seasons are optional containers for tournaments. Standalone tournaments remain valid. Each season has public dates and lifecycle state plus configurable rules for season rating, placement points, and leaderboard minimums. Archived seasons are excluded from public discovery. Season pages expose their tournaments, snapshot-backed champions, recent rating results, player leaderboard, and organization standings.

Season rating rows are updated only by events whose tournament has that `season_id`; tournaments in another season cannot leak into the board or season history. The v1 season rating is the player's career trajectory at those season events, with season-isolated matches, wins, losses, uncertainty, and confidence—not a separate rating reset at season start.
