using UnityEngine;
using UnityEngine.AI;
using UnDeadHotel.Actors;

namespace UnDeadHotel.Player
{
    [RequireComponent(typeof(NavMeshAgent))]
    public class SurvivorController : BaseActor
    {
        public NavMeshAgent agent { get; private set; }

        protected override void Start()
        {
            base.Start();
            agent = GetComponent<NavMeshAgent>();
            agent.speed = moveSpeed;
        }

        public void MoveToDestination(Vector3 target)
        {
            if (agent.isActiveAndEnabled && agent.isOnNavMesh)
            {
                agent.SetDestination(target);
            }
            else
            {
                Debug.LogWarning($"{gameObject.name} tried to move but agent is not on NavMesh!");
            }
        }
    }
}
