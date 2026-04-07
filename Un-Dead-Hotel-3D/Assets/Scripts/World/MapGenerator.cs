using UnityEngine;

namespace World
{
    public enum ChunkType
    {
        Atrium, // 3x3 center void
        MapEdgeCorner,
        MapEdgeStraight,
        NormalCorner,
        NormalStraight,
        AtriumEdgeCorner,
        AtriumEdgeStraight
    }

    public struct ChunkData
    {
        public int x;
        public int y;
        public ChunkType type;
        public int rotationDegrees;
    }

    public class MapGenerator : MonoBehaviour
    {
        [Header("Map Settings")]
        public int mapWidthChunks = 11;
        public int mapHeightChunks = 11;

        public ChunkData[,] chunkGrid { get; private set; }

        private void Start()
        {
            GenerateMap();
        }

        private void OnValidate()
        {
            // Delay the generation slightly so Unity doesn't complain about SendMessage during OnValidate
            UnityEditor.EditorApplication.delayCall += () =>
            {
                if (this != null) GenerateMap();
            };
        }

        public void GenerateMap()
        {
            chunkGrid = new ChunkData[mapWidthChunks, mapHeightChunks];

            for (int x = 0; x < mapWidthChunks; x++)
            {
                for (int y = 0; y < mapHeightChunks; y++)
                {
                    // 1. Calculate Concentric Ring Depth
                    int distLeft = x;
                    int distRight = mapWidthChunks - 1 - x;
                    int distBottom = y;
                    int distTop = mapHeightChunks - 1 - y;

                    int ring = Mathf.Min(distLeft, distRight, distBottom, distTop);

                    // 2. Identify Corners
                    bool isCorner = (x == ring || x == mapWidthChunks - 1 - ring) && 
                                    (y == ring || y == mapHeightChunks - 1 - ring);

                    // 3. Classify Chunk Type based on Ring
                    ChunkType type = ChunkType.NormalStraight;
                    if (ring == 0)
                    {
                        type = isCorner ? ChunkType.MapEdgeCorner : ChunkType.MapEdgeStraight;
                    }
                    else if (ring == 1 || ring == 2)
                    {
                        type = isCorner ? ChunkType.NormalCorner : ChunkType.NormalStraight;
                    }
                    else if (ring == 3)
                    {
                        type = isCorner ? ChunkType.AtriumEdgeCorner : ChunkType.AtriumEdgeStraight;
                    }
                    else if (ring >= 4)
                    {
                        type = ChunkType.Atrium;
                    }

                    // 4. Determine Y-Axis Rotation
                    int rotation = 0;
                    if (isCorner)
                    {
                        if (x == ring && y == ring) rotation = 0;                                 // SW: Default up
                        else if (x == mapWidthChunks - 1 - ring && y == ring) rotation = 90;      // SE: Right 90
                        else if (x == mapWidthChunks - 1 - ring && y == mapHeightChunks - 1 - ring) rotation = 180; // NE: 180
                        else if (x == ring && y == mapHeightChunks - 1 - ring) rotation = 270;    // NW: Left 270
                    }
                    else
                    {
                        if (y == ring) rotation = 0;                            // Bottom edge
                        else if (x == mapWidthChunks - 1 - ring) rotation = 90; // Right edge
                        else if (y == mapHeightChunks - 1 - ring) rotation = 180; // Top edge
                        else if (x == ring) rotation = 270;                     // Left edge
                    }

                    chunkGrid[x, y] = new ChunkData 
                    { 
                        x = x, 
                        y = y, 
                        type = type, 
                        rotationDegrees = rotation 
                    };
                }
            }
            
            Debug.Log("Generated 11x11 Modular Chunk Prefab Map.");
        }
    }
}
