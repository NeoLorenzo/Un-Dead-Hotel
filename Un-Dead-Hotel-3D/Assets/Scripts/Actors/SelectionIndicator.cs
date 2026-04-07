using UnityEngine;

namespace UnDeadHotel.Actors
{
    public class SelectionIndicator : MonoBehaviour
    {
        public bool isSelected = false;
        public GameObject indicatorVisual;

        private void Update()
        {
            if (indicatorVisual != null)
            {
                indicatorVisual.SetActive(isSelected);
                
                // Spin slowly for visual interest
                if (isSelected) 
                    indicatorVisual.transform.Rotate(Vector3.up, 90f * Time.deltaTime);
            }
        }
    }
}