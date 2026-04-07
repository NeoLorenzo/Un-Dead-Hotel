using UnityEngine;
using UnityEngine.InputSystem;
using UnDeadHotel.Player;

namespace UnDeadHotel.Player
{
    public class PlayerInteractor : MonoBehaviour
    {
        [Header("Selection")]
        public SurvivorController selectedSurvivor;

        [Header("Settings")]
        public LayerMask floorLayer;

        private Camera mainCamera;
        private Mouse mouse;

        private void Start()
        {
            mainCamera = Camera.main;
        }

        private void Update()
        {
            mouse = Mouse.current;
            if (mouse == null) return;

            // Right click to move selected survivor
            if (mouse.rightButton.wasPressedThisFrame)
            {
                HandleMoveCommand();
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
