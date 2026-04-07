using UnityEngine;

namespace World
{
    public class GridVisualizer : MonoBehaviour
    {
        [Header("Grid Display Settings")]
        public bool showChunkBorders = true;
        public Color chunkColor = Color.yellow;

        public bool showTileBorders = true;
        public Color tileColor = new Color(1f, 1f, 1f, 0.2f);
        public bool drawFullTileGrid = false;
        [Tooltip("If not drawing full grid, how many chunks should the preview cover?")]
        public int tilePreviewAreaChunks = 1;

        public bool showMicroBorders = false;
        public Color microColor = new Color(0.5f, 0.5f, 0.5f, 0.1f);
        public bool drawFullMicroGrid = false;
        [Tooltip("If not drawing full grid, how many chunks should the preview cover?")]
        public int microPreviewAreaChunks = 1;

        [Header("Map Settings")]
        public int mapWidthChunks = 11;
        public int mapHeightChunks = 11;
        
        [Header("Preview Settings")]
        [Tooltip("The chunk coordinate where the denser grids will start drawing from if not set to full grid.")]
        public Vector2Int previewChunkOffset = Vector2Int.zero;

        [Header("Procedural Generation Visualization")]
        public MapGenerator mapGenerator;

        [Header("Chunk Colors")]
        public Color atriumColor = new Color(0, 0, 0, 0.8f);
        public Color mapEdgeCornerColor = new Color(1f, 0.2f, 0.2f, 0.5f);
        public Color mapEdgeStraightColor = new Color(1f, 0.6f, 0.2f, 0.5f);
        public Color normalCornerColor = new Color(0.8f, 0.8f, 0.2f, 0.5f);
        public Color normalStraightColor = new Color(0.2f, 0.8f, 0.2f, 0.5f);
        public Color atriumEdgeCornerColor = new Color(0.2f, 0.8f, 0.8f, 0.5f);
        public Color atriumEdgeStraightColor = new Color(0.2f, 0.2f, 1f, 0.5f);

        private void OnDrawGizmos()
        {
            if (mapGenerator != null && mapGenerator.chunkGrid != null)
            {
                for (int x = 0; x < mapGenerator.mapWidthChunks; x++)
                {
                    for (int y = 0; y < mapGenerator.mapHeightChunks; y++)
                    {
                        var chunk = mapGenerator.chunkGrid[x, y];
                        
                        Gizmos.color = GetChunkColor(chunk.type);
                        
                        // Slightly shrink the visual box to leave a 1m gap between chunks
                        Vector3 center = new Vector3(x * GridManager.ChunkSize + GridManager.ChunkSize / 2f, 0.5f, y * GridManager.ChunkSize + GridManager.ChunkSize / 2f);
                        Vector3 size = new Vector3(GridManager.ChunkSize - 1f, 1f, GridManager.ChunkSize - 1f); 
                        
                        if (chunk.type == ChunkType.Atrium) 
                        {
                            size.y = 80f; // Tall dark box for Atrium void
                            center.y = 40f; 
                            Gizmos.DrawCube(center, size);
                        } 
                        else 
                        {
                            Gizmos.DrawCube(center, size);
                            DrawDirectionArrow(center, chunk.rotationDegrees);
                        }
                    }
                }
            }

            float mapWidth = mapWidthChunks * GridManager.ChunkSize;
            float mapHeight = mapHeightChunks * GridManager.ChunkSize;

            if (showChunkBorders)
            {
                Gizmos.color = chunkColor;

                // Draw bounding box for the entire map
                Vector3 center = new Vector3(mapWidth / 2f, 0, mapHeight / 2f);
                Vector3 size = new Vector3(mapWidth, 0.1f, mapHeight);
                Gizmos.DrawWireCube(center, size);

                // Draw interior chunk lines
                for (int x = 0; x <= mapWidthChunks; x++)
                {
                    Vector3 start = new Vector3(x * GridManager.ChunkSize, 0, 0);
                    Vector3 end = new Vector3(x * GridManager.ChunkSize, 0, mapHeight);
                    Gizmos.DrawLine(start, end);
                }

                for (int z = 0; z <= mapHeightChunks; z++)
                {
                    Vector3 start = new Vector3(0, 0, z * GridManager.ChunkSize);
                    Vector3 end = new Vector3(mapWidth, 0, z * GridManager.ChunkSize);
                    Gizmos.DrawLine(start, end);
                }
            }

            if (showTileBorders || showMicroBorders)
            {
                float previewStartX = drawFullTileGrid && drawFullMicroGrid ? 0 : Mathf.Clamp(previewChunkOffset.x * GridManager.ChunkSize, 0, mapWidth);
                float previewStartZ = drawFullTileGrid && drawFullMicroGrid ? 0 : Mathf.Clamp(previewChunkOffset.y * GridManager.ChunkSize, 0, mapHeight);
                
                if (showTileBorders)
                {
                    float startX = drawFullTileGrid ? 0 : previewStartX;
                    float startZ = drawFullTileGrid ? 0 : previewStartZ;
                    float endX = drawFullTileGrid ? mapWidth : Mathf.Clamp((previewChunkOffset.x + tilePreviewAreaChunks) * GridManager.ChunkSize, 0, mapWidth);
                    float endZ = drawFullTileGrid ? mapHeight : Mathf.Clamp((previewChunkOffset.y + tilePreviewAreaChunks) * GridManager.ChunkSize, 0, mapHeight);
                    
                    Gizmos.color = tileColor;
                    float tx = startX;
                    while (tx <= endX)
                    {
                        Gizmos.DrawLine(new Vector3(tx, 0, startZ), new Vector3(tx, 0, endZ));
                        tx += GridManager.TileSize;
                    }
                    float tz = startZ;
                    while (tz <= endZ)
                    {
                        Gizmos.DrawLine(new Vector3(startX, 0, tz), new Vector3(endX, 0, tz));
                        tz += GridManager.TileSize;
                    }
                }

                if (showMicroBorders)
                {
                    float startX = drawFullMicroGrid ? 0 : previewStartX;
                    float startZ = drawFullMicroGrid ? 0 : previewStartZ;
                    float endX = drawFullMicroGrid ? mapWidth : Mathf.Clamp((previewChunkOffset.x + microPreviewAreaChunks) * GridManager.ChunkSize, 0, mapWidth);
                    float endZ = drawFullMicroGrid ? mapHeight : Mathf.Clamp((previewChunkOffset.y + microPreviewAreaChunks) * GridManager.ChunkSize, 0, mapHeight);

                    Gizmos.color = microColor;
                    float mx = startX;
                    while (mx <= endX)
                    {
                        Gizmos.DrawLine(new Vector3(mx, 0, startZ), new Vector3(mx, 0, endZ));
                        mx += GridManager.MicroSize;
                    }
                    float mz = startZ;
                    while (mz <= endZ)
                    {
                        Gizmos.DrawLine(new Vector3(startX, 0, mz), new Vector3(endX, 0, mz));
                        mz += GridManager.MicroSize;
                    }
                }
            }
        }

        private Color GetChunkColor(ChunkType type)
        {
            switch (type)
            {
                case ChunkType.Atrium: return atriumColor;
                case ChunkType.MapEdgeCorner: return mapEdgeCornerColor;
                case ChunkType.MapEdgeStraight: return mapEdgeStraightColor;
                case ChunkType.NormalCorner: return normalCornerColor;
                case ChunkType.NormalStraight: return normalStraightColor;
                case ChunkType.AtriumEdgeCorner: return atriumEdgeCornerColor;
                case ChunkType.AtriumEdgeStraight: return atriumEdgeStraightColor;
                default: return Color.white;
            }
        }

        private void DrawDirectionArrow(Vector3 center, int rotationDegrees)
        {
            Vector3 forward = Quaternion.Euler(0, rotationDegrees, 0) * Vector3.forward;
            Gizmos.color = Color.white;
            Vector3 startPos = center + Vector3.up * 2f;
            Vector3 endPos = startPos + forward * 8f;
            Gizmos.DrawRay(startPos, forward * 8f); 
            Gizmos.DrawSphere(endPos, 1f); // Arrowhead
        }
    }
}
