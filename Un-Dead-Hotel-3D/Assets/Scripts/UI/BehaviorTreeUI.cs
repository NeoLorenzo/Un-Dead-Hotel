using UnityEngine;
using UnityEngine.UI;
using TMPro; // Assuming TMPro is in the project, it's standard.
using UnDeadHotel.Player;

namespace UnDeadHotel.UI
{
    public class BehaviorTreeUI : MonoBehaviour
    {
        private PlayerInteractor interactor;
        private TextMeshProUGUI treeText;
        private Canvas uiCanvas;

        private void Start()
        {
            interactor = FindAnyObjectByType<PlayerInteractor>();

            // Create Canvas Programmatically
            GameObject canvasGO = new GameObject("BehaviorTree_Canvas");
            uiCanvas = canvasGO.AddComponent<Canvas>();
            uiCanvas.renderMode = RenderMode.ScreenSpaceOverlay;
            uiCanvas.sortingOrder = 100; // Top layer
            
            var scaler = canvasGO.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1920, 1080);
            canvasGO.AddComponent<GraphicRaycaster>();

            // Create Background
            GameObject bgGO = new GameObject("Tree_Background");
            bgGO.transform.SetParent(canvasGO.transform, false);
            var bgImage = bgGO.AddComponent<Image>();
            bgImage.color = new Color(0.1f, 0.1f, 0.1f, 0.8f); // Dark semi-transparent
            
            RectTransform bgRect = bgImage.rectTransform;
            bgRect.anchorMin = new Vector2(0, 1);
            bgRect.anchorMax = new Vector2(0, 1);
            bgRect.pivot = new Vector2(0, 1);
            bgRect.anchoredPosition = new Vector2(10, -10); // slightly larger padding around text
            bgRect.sizeDelta = new Vector2(400, 320); // Static sized padded box

            // Create Text Node
            GameObject textGO = new GameObject("Tree_Text");
            textGO.transform.SetParent(bgGO.transform, false);

            treeText = textGO.AddComponent<TextMeshProUGUI>();
            treeText.fontSize = 28;
            treeText.fontStyle = FontStyles.Bold;
            treeText.color = Color.white;
            treeText.alignment = TextAlignmentOptions.TopLeft;

            // Set anchoring to Top-Left inside the background
            RectTransform rect = treeText.rectTransform;
            rect.anchorMin = new Vector2(0, 1); // Top Left
            rect.anchorMax = new Vector2(0, 1);
            rect.pivot = new Vector2(0, 1);
            rect.anchoredPosition = new Vector2(10, -10); // 10px padding from the background
            rect.sizeDelta = new Vector2(380, 400); // Scale relative to parent

            // Keep alive
            DontDestroyOnLoad(canvasGO);
            DontDestroyOnLoad(this.gameObject);
        }

        private void Update()
        {
            if (interactor == null || interactor.selectedGuest == null)
            {
                if (treeText != null)
                {
                    treeText.text = "No Guest Selected";
                }
                return;
            }

            // Fetch the updated tree state every frame
            string behaviorLog = "<b>Guest Behavior Tree</b>\n";
            behaviorLog += $"Health: {interactor.selectedGuest.currentHealth}\n\n";
            behaviorLog += interactor.selectedGuest.GetBehaviorTreeStatus();

            treeText.text = behaviorLog;
        }
    }
}
