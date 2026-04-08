using UnityEngine;
using UnityEngine.AI;
using UnDeadHotel.Player;

namespace UnDeadHotel.World
{
    public class GameManager : MonoBehaviour
    {
        [Header("Prefabs")]
        public GameObject survivorPrefab;

        [Header("Spawning")]
        public float spawnRadius = 150f;
        public Vector3 spawnCenter = new Vector3(176f, 0f, 176f);
        public float minSafeDistance = 30f;

        [Header("Zombies")]
        public GameObject zombiePrefab;
        public int initialZombieCount = 10;

        [Header("Guests")]
        public GameObject guestPrefab;
        public int initialGuestCount = 5;

        private GameObject playerInstance;

        private void Start()
        {
            SpawnPlayer();
            SpawnZombies(initialZombieCount);
            SpawnGuests(initialGuestCount);

            // Spawn Behavior Tree Debug UI
            new GameObject("BehaviorTreeUI_Manager").AddComponent<UnDeadHotel.UI.BehaviorTreeUI>();
        }

        public void SpawnPlayer()
        {
            if (survivorPrefab == null)
            {
                Debug.LogError("No survivor prefab assigned to GameManager.");
                return;
            }

            Vector3 randomPos = GetRandomNavMeshPoint();
            playerInstance = Instantiate(survivorPrefab, randomPos, Quaternion.identity);
            playerInstance.name = "Player_Survivor_Dynamic";

            // Link to interactor
            PlayerInteractor interactor = FindFirstObjectByType<PlayerInteractor>();
            if (interactor != null)
            {
                interactor.selectedSurvivor = playerInstance.GetComponent<SurvivorController>();
                
                // Focus camera on spawn point correctly via CameraController
                var camCtrl = Camera.main.GetComponent<CameraController>();
                if (camCtrl != null)
                {
                    camCtrl.SetPosition(randomPos);
                }
                else
                {
                    Camera.main.transform.position = new Vector3(randomPos.x, 50f, randomPos.z);
                }
            }
            
            Debug.Log($"Survivor spawned at {randomPos}");
        }

        public void SpawnZombies(int count)
        {
            if (zombiePrefab == null) return;

            for (int i = 0; i < count; i++)
            {
                Vector3 spawnPos = GetRandomNavMeshPoint(true);
                Instantiate(zombiePrefab, spawnPos, Quaternion.identity);
            }
            Debug.Log($"Spawned {count} zombies.");
        }

        public void SpawnGuests(int count)
        {
            if (guestPrefab == null) return;

            for (int i = 0; i < count; i++)
            {
                // Try to spawn guests in rooms initially if possible, or anywhere safe
                Vector3 spawnPos = GetRandomNavMeshPoint(true);
                Instantiate(guestPrefab, spawnPos, Quaternion.identity);
            }
            Debug.Log($"Spawned {count} guests.");
        }

        private Vector3 GetRandomNavMeshPoint(bool checkSafeDist = false)
        {
            for (int i = 0; i < 50; i++)
            {
                Vector3 randomDir = Random.insideUnitSphere * spawnRadius;
                randomDir += spawnCenter;
                NavMeshHit hit;
                if (NavMesh.SamplePosition(randomDir, out hit, 15f, NavMesh.AllAreas))
                {
                    if (checkSafeDist && playerInstance != null)
                    {
                        if (Vector3.Distance(hit.position, playerInstance.transform.position) < minSafeDistance)
                            continue;
                    }
                    return hit.position;
                }
            }
            return spawnCenter; // Fallback
        }
    }
}