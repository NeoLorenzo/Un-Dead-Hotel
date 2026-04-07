using UnityEngine;
using UnityEngine.UI;

namespace UnDeadHotel.Actors
{
    public class ActorHUD : MonoBehaviour
    {
        [Header("Settings")]
        public Slider hpSlider;
        public GameObject hudContainer;
        public float showDuration = 3f;

        private BaseActor actor;
        private float lastDamageTime = -100f;
        private Camera mainCam;

        private void Start()
        {
            actor = GetComponentInParent<BaseActor>();
            mainCam = Camera.main;
            
            if (hudContainer != null) 
                hudContainer.SetActive(false);
        }

        private void Update()
        {
            if (actor == null || hudContainer == null) return;

            // Update Billboard: Face camera (orthogonal 90 deg down, but still)
            // Just match camera rotation for top-down
            transform.rotation = mainCam.transform.rotation;

            // Update HP
            if (hpSlider != null)
            {
                hpSlider.value = actor.currentHealth / actor.maxHealth;
            }

            // Visibility handling: Show only after damage
            bool shouldShow = (Time.time < lastDamageTime + showDuration);
            if (hudContainer.activeSelf != shouldShow)
            {
                hudContainer.SetActive(shouldShow);
            }
        }

        public void NotifyDamage()
        {
            lastDamageTime = Time.time;
        }
    }
}