using UnityEngine;
using UnityEngine.AI;
using System.Collections;
using System.Collections.Generic;

namespace UnDeadHotel.Actors
{
    [RequireComponent(typeof(NavMeshAgent))]
    public class ZombieController : BaseActor
    {
        public enum AIState { Wander, Chase }
        
        [Header("AI Config")]
        public AIState currentState = AIState.Wander;
        public float detectionRange = 12f;
        public float viewAngle = 110f;
        public float hearingRadius = 2.0f;
        public float damageAmount = 20f;
        public float attackCooldown = 1.0f;
        public float chasePersistence = 3.0f;
        public LayerMask obstacleLayer;
        
        [Header("Wander Settings")]
        public float wanderRadius = 15f;
        public float wanderWaitTime = 2f;

        private NavMeshAgent agent;
        private BaseActor targetHuman;
        private float nextAttackTime;
        private bool isWandering;
        private float lostTargetTimer;
        private Vector3 lastKnownPosition;

        protected override void Start()
        {
            base.Start();
            agent = GetComponent<NavMeshAgent>();
            agent.speed = moveSpeed;
            teamID = 1; // Zombie
            
            // Default obstacle layer to Layer 6 (Wall) if not set
            if (obstacleLayer == 0) obstacleLayer = 1 << 6;
        }

        private void Update()
        {
            switch (currentState)
            {
                case AIState.Wander:
                    HandleWander();
                    CheckForHumans();
                    break;
                case AIState.Chase:
                    HandleChase();
                    break;
            }
        }

        private void HandleWander()
        {
            if (!agent.pathPending && agent.remainingDistance < 0.5f && !isWandering)
            {
                StartCoroutine(WanderRoutine());
            }
        }

        private IEnumerator WanderRoutine()
        {
            isWandering = true;
            yield return new WaitForSeconds(wanderWaitTime);
            
            Vector3 randomPos = Random.insideUnitSphere * wanderRadius;
            randomPos += transform.position;
            
            if (NavMesh.SamplePosition(randomPos, out NavMeshHit hit, wanderRadius, NavMesh.AllAreas))
            {
                agent.SetDestination(hit.position);
            }
            
            isWandering = false;
        }

        private void CheckForHumans()
        {
            BaseActor[] actors = FindObjectsByType<BaseActor>(FindObjectsSortMode.None);
            
            foreach (var actor in actors)
            {
                if (actor.teamID == 0) // Human
                {
                    if (CanSeeTarget(actor))
                    {
                        targetHuman = actor;
                        currentState = AIState.Chase;
                        lostTargetTimer = 0f;
                        return;
                    }
                }
            }
        }

        private bool CanSeeTarget(BaseActor target)
        {
            Vector3 dirToTarget = target.transform.position - transform.position;
            float dist = dirToTarget.magnitude;

            if (dist > detectionRange) return false;

            // 1. Hearing Radius (360 degrees)
            if (dist < hearingRadius) return true;

            // 2. FOV Check
            float angle = Vector3.Angle(transform.forward, dirToTarget);
            if (angle < viewAngle / 2f)
            {
                // 3. LOS Raycast (Eye level to target center)
                Vector3 eyePos = transform.position + Vector3.up * 1.5f;
                Vector3 targetPos = target.transform.position + Vector3.up * 0.8f;
                Vector3 rayDir = targetPos - eyePos;

                if (!Physics.Raycast(eyePos, rayDir, dist, obstacleLayer))
                {
                    return true;
                }
            }

            return false;
        }

        private void HandleChase()
        {
            if (targetHuman == null)
            {
                currentState = AIState.Wander;
                return;
            }

            bool currentlyVisible = CanSeeTarget(targetHuman);

            if (currentlyVisible)
            {
                lastKnownPosition = targetHuman.transform.position;
                lostTargetTimer = 0f;
                agent.isStopped = (Vector3.Distance(transform.position, lastKnownPosition) < 0.75f);
                if (!agent.isStopped) agent.SetDestination(lastKnownPosition);
            }
            else
            {
                // Persistence: Keep moving toward last known position for a few seconds
                lostTargetTimer += Time.deltaTime;
                agent.isStopped = false;
                agent.SetDestination(lastKnownPosition);

                if (lostTargetTimer > chasePersistence || agent.remainingDistance < 0.5f)
                {
                    targetHuman = null;
                    currentState = AIState.Wander;
                    return;
                }
            }

            // Simple separation from other zombies
            ApplySeparation();

            // Attack logic: only if target is visible and close
            float dist = Vector3.Distance(transform.position, targetHuman.transform.position);
            if (currentlyVisible && dist < 0.8f && Time.time >= nextAttackTime)
            {
                AttackTarget();
            }
        }

        private void OnDrawGizmosSelected()
        {
            // Draw Vision Cone
            Gizmos.color = (currentState == AIState.Chase) ? Color.red : Color.yellow;
            Vector3 leftRay = Quaternion.Euler(0, -viewAngle / 2, 0) * transform.forward;
            Vector3 rightRay = Quaternion.Euler(0, viewAngle / 2, 0) * transform.forward;
            Gizmos.DrawRay(transform.position + Vector3.up, leftRay * detectionRange);
            Gizmos.DrawRay(transform.position + Vector3.up, rightRay * detectionRange);
            
            // Draw Hearing Radius
            Gizmos.color = Color.blue;
            Gizmos.DrawWireSphere(transform.position, hearingRadius);
        }

        private void ApplySeparation()
        {
            // Find nearby zombies to push away from
            Collider[] colls = Physics.OverlapSphere(transform.position, 0.5f);
            Vector3 separation = Vector3.zero;

            foreach (var coll in colls)
            {
                if (coll.gameObject != gameObject && (coll.CompareTag("Zombie") || coll.GetComponent<ZombieController>()))
                {
                    Vector3 diff = transform.position - coll.transform.position;
                    separation += diff.normalized / (diff.magnitude + 0.1f);
                }
            }

            if (separation != Vector3.zero)
            {
                // Apply a small offset to the agent's velocity/position
                transform.position += separation * Time.deltaTime * 1.5f;
            }
        }

        private void AttackTarget()
        {
            if (targetHuman != null)
            {
                targetHuman.TakeDamage(damageAmount);
                nextAttackTime = Time.time + attackCooldown;
                Debug.Log($"Zombie attacked {targetHuman.gameObject.name}!");
            }
        }
    }
}