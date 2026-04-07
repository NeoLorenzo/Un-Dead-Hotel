using UnityEngine;

namespace UnDeadHotel.Actors
{
    public class BaseActor : MonoBehaviour
    {
        [Header("Common Stats")]
        public float maxHealth = 100f;
        public float currentHealth;
        public float moveSpeed = 3.5f;

        [Header("Identification")]
        public int teamID; // 0 for Humans, 1 for Zombies
        public string actorName;

        [Header("Visual Feedback")]
        public Color flashColor = Color.red;
        public float flashDuration = 0.1f;
        private Renderer actorRenderer;
        private Color originalColor;

        protected virtual void Start()
        {
            currentHealth = maxHealth;
            actorRenderer = GetComponent<Renderer>();
            if (actorRenderer != null) originalColor = actorRenderer.material.color;
        }

        public virtual void TakeDamage(float amount)
        {
            currentHealth -= amount;
            StartCoroutine(FlashRoutine());
            if (currentHealth <= 0)
            {
                Die();
            }
        }

        private System.Collections.IEnumerator FlashRoutine()
        {
            if (actorRenderer == null) yield break;
            actorRenderer.material.color = flashColor;
            yield return new WaitForSeconds(flashDuration);
            actorRenderer.material.color = originalColor;
        }

        protected virtual void Die()
        {
            Debug.Log($"{gameObject.name} has died.");
            Destroy(gameObject);
        }
    }
}