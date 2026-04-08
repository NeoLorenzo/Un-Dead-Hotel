using UnityEngine;
using UnityEngine.InputSystem;

namespace UnDeadHotel.Player
{
    [RequireComponent(typeof(Camera))]
    public class CameraController : MonoBehaviour
    {
        [Header("Movement Settings")]
        public float panSpeed = 40f;
        public float panBorderThickness = 10f;
        public bool enableEdgeScrolling = true;

        [Header("Zoom Settings")]
        public float scrollSpeed = 10f;
        public float minZoom = 10f;
        public float maxZoom = 120f;

        [Header("Smoothing")]
        public float smoothTime = 0.15f;
        public float zoomSmoothTime = 0.15f;

        [Header("Map Limits")]
        public Vector2 mapBoundsMin = new Vector2(0f, 0f);
        public Vector2 mapBoundsMax = new Vector2(352f, 352f);

        private Camera cam;
        private Keyboard keyboard;
        private Mouse mouse;

        private Vector3 targetPosition;
        private Vector3 currentVelocity;
        private float targetZoom;
        private float zoomVelocity;

        private void Awake()
        {
            cam = GetComponent<Camera>();
            // Initialize targetPosition only if it hasn't been set externally yet
            if (targetPosition == Vector3.zero)
            {
                targetPosition = transform.position;
            }
            targetZoom = cam.orthographicSize;
        }

        private void Start()
        {
            // Empty to avoid duplication with Awake
        }

        public void SetPosition(Vector3 worldPos)
        {
            // Update both to prevent SmoothDamp from pulling back to old position
            targetPosition = new Vector3(worldPos.x, transform.position.y, worldPos.z);
            transform.position = targetPosition;
            currentVelocity = Vector3.zero;
        }

        public Transform followTarget;

        private void Update()
        {
            keyboard = Keyboard.current;
            mouse = Mouse.current;
            if (keyboard == null) return;

            HandleMovement();
            HandleZoom();
        }

        private void HandleMovement()
        {
            // Scale pan speed based on zoom level (slower when zoomed in, faster when zoomed out)
            float zoomFactor = cam.orthographicSize / maxZoom;
            float currentPanSpeed = panSpeed * zoomFactor;

            bool manualInputDetected = false;

            // WASD / Arrow Keys
            if (keyboard.wKey.isPressed || keyboard.upArrowKey.isPressed) { targetPosition.z += currentPanSpeed * Time.deltaTime; manualInputDetected = true; }
            if (keyboard.sKey.isPressed || keyboard.downArrowKey.isPressed) { targetPosition.z -= currentPanSpeed * Time.deltaTime; manualInputDetected = true; }
            if (keyboard.dKey.isPressed || keyboard.rightArrowKey.isPressed) { targetPosition.x += currentPanSpeed * Time.deltaTime; manualInputDetected = true; }
            if (keyboard.aKey.isPressed || keyboard.leftArrowKey.isPressed) { targetPosition.x -= currentPanSpeed * Time.deltaTime; manualInputDetected = true; }

            // Edge Scrolling
            if (enableEdgeScrolling && mouse != null && !manualInputDetected)
            {
                Vector2 mPos = mouse.position.ReadValue();
                // Check if mouse is within a reasonable range and not just at (0,0)
                if (mPos.x > 0.1f && mPos.y > 0.1f && mPos.x < Screen.width - 0.1f && mPos.y < Screen.height - 0.1f)
                {
                    if (mPos.y >= Screen.height - panBorderThickness) { targetPosition.z += currentPanSpeed * Time.deltaTime; manualInputDetected = true; }
                    if (mPos.y <= panBorderThickness) { targetPosition.z -= currentPanSpeed * Time.deltaTime; manualInputDetected = true; }
                    if (mPos.x >= Screen.width - panBorderThickness) { targetPosition.x += currentPanSpeed * Time.deltaTime; manualInputDetected = true; }
                    if (mPos.x <= panBorderThickness) { targetPosition.x -= currentPanSpeed * Time.deltaTime; manualInputDetected = true; }
                }
            }

            // Middle Mouse Drag explicitly breaking follow
            if (mouse != null && mouse.middleButton.isPressed)
            {
                manualInputDetected = true;
            }

            if (manualInputDetected)
            {
                followTarget = null;
            }

            if (followTarget != null)
            {
                targetPosition = new Vector3(followTarget.position.x, targetPosition.y, followTarget.position.z);
            }

            // Clamp target bounds
            targetPosition.x = Mathf.Clamp(targetPosition.x, mapBoundsMin.x, mapBoundsMax.x);
            targetPosition.z = Mathf.Clamp(targetPosition.z, mapBoundsMin.y, mapBoundsMax.y);

            // Smoothly move towards the target position
            transform.position = Vector3.SmoothDamp(transform.position, targetPosition, ref currentVelocity, smoothTime);
        }

        private void HandleZoom()
        {
            if (mouse == null) return;

            float scroll = mouse.scroll.ReadValue().y;
            if (scroll != 0f)
            {
                // Note: We don't use Time.deltaTime here for the input because scroll is a delta event,
                // but SmoothDamp handles the interpolation over time.
                targetZoom -= scroll * (scrollSpeed / 100f); // Adjust multiplier for sensitivity
                targetZoom = Mathf.Clamp(targetZoom, minZoom, maxZoom);
            }

            // Smoothly adjust the orthographic size
            cam.orthographicSize = Mathf.SmoothDamp(cam.orthographicSize, targetZoom, ref zoomVelocity, zoomSmoothTime);
        }
    }
}