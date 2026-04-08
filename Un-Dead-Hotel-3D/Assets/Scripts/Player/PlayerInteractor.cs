using UnityEngine;
using UnityEngine.InputSystem;
using UnDeadHotel.Player;

namespace UnDeadHotel.Player
{
    public class PlayerInteractor : MonoBehaviour
    {
        [Header("Selection")]
        public SurvivorController selectedSurvivor;
        public UnDeadHotel.Actors.GuestController selectedGuest;

        [Header("Settings")]
        public LayerMask floorLayer;
        public LayerMask actorLayer;

        private Camera mainCamera;
        private CameraController cameraController;
        private Mouse mouse;

        private void Start()
        {
            mainCamera = Camera.main;
            cameraController = FindAnyObjectByType<CameraController>();
        }

        private void Update()
        {
            mouse = Mouse.current;
            if (mouse == null) return;

            // Left click to select Guests/Actors
            if (mouse.leftButton.wasPressedThisFrame)
            {
                HandleSelectCommand();
            }

            // Right click to move selected survivor
            if (mouse.rightButton.wasPressedThisFrame)
            {
                HandleMoveCommand();
            }
        }

        private void HandleSelectCommand()
        {
            Ray ray = mainCamera.ScreenPointToRay(mouse.position.ReadValue());
            RaycastHit[] hits = Physics.RaycastAll(ray, 1000f);
            foreach (var hit in hits)
            {
                var guest = hit.collider.GetComponentInParent<UnDeadHotel.Actors.GuestController>();
                if (guest != null)
                {
                    selectedGuest = guest;
                    if (cameraController != null)
                    {
                        cameraController.followTarget = guest.transform;
                    }
                    Debug.Log($"Selected Guest: {guest.gameObject.name}");
                    return;
                }
            }
        }

        private void HandleMoveCommand()
        {
            if (selectedSurvivor == null) return;

            Ray ray = mainCamera.ScreenPointToRay(mouse.position.ReadValue());
            if (Physics.Raycast(ray, out RaycastHit hit, 1000f, floorLayer))
            {
                selectedSurvivor.MoveToDestination(hit.point);
                Debug.Log($"Moving {selectedSurvivor.gameObject.name} to {hit.point}");
            }
        }
    }
}
