using UnityEngine;

namespace World
{
    public static class GridManager
    {
        public const float ChunkSize = 32f;
        public const float TileSize = 1f;
        public const float MicroSize = 0.25f;

        // X/Z mapping based on top-down view
        public static Vector2Int WorldToChunk(Vector3 worldPos)
        {
            int x = Mathf.FloorToInt(worldPos.x / ChunkSize);
            int y = Mathf.FloorToInt(worldPos.z / ChunkSize);
            return new Vector2Int(x, y);
        }

        public static Vector3 ChunkToWorld(Vector2Int chunkPos)
        {
            return new Vector3(chunkPos.x * ChunkSize, 0, chunkPos.y * ChunkSize);
        }

        public static Vector2Int WorldToTile(Vector3 worldPos)
        {
            int x = Mathf.FloorToInt(worldPos.x / TileSize);
            int y = Mathf.FloorToInt(worldPos.z / TileSize);
            return new Vector2Int(x, y);
        }

        public static Vector3 TileToWorld(Vector2Int tilePos)
        {
            return new Vector3(tilePos.x * TileSize, 0, tilePos.y * TileSize);
        }

        public static Vector2Int WorldToMicro(Vector3 worldPos)
        {
            int x = Mathf.FloorToInt(worldPos.x / MicroSize);
            int y = Mathf.FloorToInt(worldPos.z / MicroSize);
            return new Vector2Int(x, y);
        }
    }
}
