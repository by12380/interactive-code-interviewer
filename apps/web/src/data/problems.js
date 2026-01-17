// Coding problems database with test cases, hints, and solutions

export const PROBLEMS = [
  {
    id: "two-sum",
    title: "Two Sum",
    difficulty: "Easy",
    category: "Arrays & Hashing",
    description: `Given an array of integers \`nums\` and an integer \`target\`, return indices of the two numbers such that they add up to \`target\`.

You may assume that each input would have **exactly one solution**, and you may not use the same element twice.

You can return the answer in any order.`,
    examples: [
      {
        input: "nums = [2,7,11,15], target = 9",
        output: "[0,1]",
        explanation: "Because nums[0] + nums[1] == 9, we return [0, 1]."
      },
      {
        input: "nums = [3,2,4], target = 6",
        output: "[1,2]",
        explanation: "Because nums[1] + nums[2] == 6, we return [1, 2]."
      },
      {
        input: "nums = [3,3], target = 6",
        output: "[0,1]",
        explanation: "Because nums[0] + nums[1] == 6, we return [0, 1]."
      }
    ],
    constraints: [
      "2 <= nums.length <= 10^4",
      "-10^9 <= nums[i] <= 10^9",
      "-10^9 <= target <= 10^9",
      "Only one valid answer exists."
    ],
    starterCode: `function twoSum(nums, target) {
  // Your solution here
}`,
    testCases: [
      { input: { nums: [2, 7, 11, 15], target: 9 }, expected: [0, 1] },
      { input: { nums: [3, 2, 4], target: 6 }, expected: [1, 2] },
      { input: { nums: [3, 3], target: 6 }, expected: [0, 1] },
      { input: { nums: [1, 5, 8, 3, 9], target: 12 }, expected: [2, 4] },
      { input: { nums: [-1, -2, -3, -4, -5], target: -8 }, expected: [2, 4] }
    ],
    hints: [
      "A brute force approach would be to check every pair of numbers. Can you think of a way to do it in one pass?",
      "Think about what information you need to store as you iterate through the array.",
      "Use a hash map to store the numbers you've seen. For each number, check if target - num exists in the map.",
      "The key insight: for each number n, you're looking for target - n. A hash map gives O(1) lookup."
    ],
    solution: `function twoSum(nums, target) {
  const map = new Map();
  
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    
    if (map.has(complement)) {
      return [map.get(complement), i];
    }
    
    map.set(nums[i], i);
  }
  
  return []; // No solution found
}`,
    solutionExplanation: `**Approach: Hash Map (One Pass)**

1. Create a hash map to store each number and its index
2. For each number in the array, calculate its complement (target - current number)
3. Check if the complement exists in the hash map
4. If yes, return both indices; if no, add current number to the map

**Time Complexity:** O(n) - single pass through the array
**Space Complexity:** O(n) - hash map storage`,
    timeLimit: 30 * 60, // 30 minutes in seconds
    optimalComplexity: "O(n)"
  },
  {
    id: "valid-parentheses",
    title: "Valid Parentheses",
    difficulty: "Easy",
    category: "Stack",
    description: `Given a string \`s\` containing just the characters \`'('\`, \`')'\`, \`'{'\`, \`'}'\`, \`'['\` and \`']'\`, determine if the input string is valid.

An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.
3. Every close bracket has a corresponding open bracket of the same type.`,
    examples: [
      {
        input: 's = "()"',
        output: "true",
        explanation: "Simple matching parentheses."
      },
      {
        input: 's = "()[]{}"',
        output: "true",
        explanation: "Multiple types of brackets, all properly matched."
      },
      {
        input: 's = "(]"',
        output: "false",
        explanation: "Mismatched bracket types."
      },
      {
        input: 's = "([)]"',
        output: "false",
        explanation: "Brackets are not closed in correct order."
      }
    ],
    constraints: [
      "1 <= s.length <= 10^4",
      "s consists of parentheses only '()[]{}'"
    ],
    starterCode: `function isValid(s) {
  // Your solution here
}`,
    testCases: [
      { input: { s: "()" }, expected: true },
      { input: { s: "()[]{}" }, expected: true },
      { input: { s: "(]" }, expected: false },
      { input: { s: "([)]" }, expected: false },
      { input: { s: "{[]}" }, expected: true },
      { input: { s: "" }, expected: true },
      { input: { s: "((()))" }, expected: true },
      { input: { s: "(()" }, expected: false }
    ],
    hints: [
      "Think about what data structure naturally handles 'last in, first out' operations.",
      "A stack is perfect for this! Push opening brackets, pop when you see closing brackets.",
      "Use a map to pair closing brackets with their corresponding opening brackets.",
      "Don't forget edge cases: empty string, unmatched opening brackets at the end."
    ],
    solution: `function isValid(s) {
  const stack = [];
  const pairs = {
    ')': '(',
    '}': '{',
    ']': '['
  };
  
  for (const char of s) {
    if (char === '(' || char === '{' || char === '[') {
      stack.push(char);
    } else {
      if (stack.length === 0 || stack.pop() !== pairs[char]) {
        return false;
      }
    }
  }
  
  return stack.length === 0;
}`,
    solutionExplanation: `**Approach: Stack**

1. Use a stack to keep track of opening brackets
2. When we see an opening bracket, push it onto the stack
3. When we see a closing bracket, check if it matches the most recent opening bracket
4. At the end, the stack should be empty if all brackets are matched

**Time Complexity:** O(n) - single pass through the string
**Space Complexity:** O(n) - stack storage in worst case`,
    timeLimit: 25 * 60,
    optimalComplexity: "O(n)"
  },
  {
    id: "merge-intervals",
    title: "Merge Intervals",
    difficulty: "Medium",
    category: "Arrays & Sorting",
    description: `Given an array of \`intervals\` where \`intervals[i] = [start_i, end_i]\`, merge all overlapping intervals, and return an array of the non-overlapping intervals that cover all the intervals in the input.`,
    examples: [
      {
        input: "intervals = [[1,3],[2,6],[8,10],[15,18]]",
        output: "[[1,6],[8,10],[15,18]]",
        explanation: "Since intervals [1,3] and [2,6] overlap, merge them into [1,6]."
      },
      {
        input: "intervals = [[1,4],[4,5]]",
        output: "[[1,5]]",
        explanation: "Intervals [1,4] and [4,5] are considered overlapping."
      }
    ],
    constraints: [
      "1 <= intervals.length <= 10^4",
      "intervals[i].length == 2",
      "0 <= start_i <= end_i <= 10^4"
    ],
    starterCode: `function merge(intervals) {
  // Your solution here
}`,
    testCases: [
      { input: { intervals: [[1,3],[2,6],[8,10],[15,18]] }, expected: [[1,6],[8,10],[15,18]] },
      { input: { intervals: [[1,4],[4,5]] }, expected: [[1,5]] },
      { input: { intervals: [[1,4],[0,4]] }, expected: [[0,4]] },
      { input: { intervals: [[1,4],[2,3]] }, expected: [[1,4]] },
      { input: { intervals: [[1,4]] }, expected: [[1,4]] }
    ],
    hints: [
      "What if you sort the intervals first? What property would that give you?",
      "After sorting by start time, overlapping intervals will be adjacent.",
      "Compare each interval's start with the previous interval's end to detect overlap.",
      "When merging, take the minimum start and maximum end of overlapping intervals."
    ],
    solution: `function merge(intervals) {
  if (intervals.length <= 1) return intervals;
  
  // Sort by start time
  intervals.sort((a, b) => a[0] - b[0]);
  
  const result = [intervals[0]];
  
  for (let i = 1; i < intervals.length; i++) {
    const current = intervals[i];
    const lastMerged = result[result.length - 1];
    
    // Check if current overlaps with last merged interval
    if (current[0] <= lastMerged[1]) {
      // Merge by extending the end if needed
      lastMerged[1] = Math.max(lastMerged[1], current[1]);
    } else {
      // No overlap, add as new interval
      result.push(current);
    }
  }
  
  return result;
}`,
    solutionExplanation: `**Approach: Sort and Merge**

1. Sort intervals by start time
2. Initialize result with the first interval
3. For each subsequent interval:
   - If it overlaps with the last merged interval (start <= previous end), merge them
   - Otherwise, add it as a new interval

**Time Complexity:** O(n log n) - due to sorting
**Space Complexity:** O(n) - for the result array`,
    timeLimit: 35 * 60,
    optimalComplexity: "O(n log n)"
  },
  {
    id: "reverse-linked-list",
    title: "Reverse Linked List",
    difficulty: "Easy",
    category: "Linked Lists",
    description: `Given the \`head\` of a singly linked list, reverse the list, and return the reversed list.`,
    examples: [
      {
        input: "head = [1,2,3,4,5]",
        output: "[5,4,3,2,1]",
        explanation: "The linked list is reversed."
      },
      {
        input: "head = [1,2]",
        output: "[2,1]",
        explanation: "Two-node list reversed."
      },
      {
        input: "head = []",
        output: "[]",
        explanation: "Empty list remains empty."
      }
    ],
    constraints: [
      "The number of nodes in the list is in the range [0, 5000]",
      "-5000 <= Node.val <= 5000"
    ],
    starterCode: `// Definition for singly-linked list node:
// class ListNode {
//   constructor(val = 0, next = null) {
//     this.val = val;
//     this.next = next;
//   }
// }

function reverseList(head) {
  // Your solution here
}`,
    testCases: [
      { input: { head: [1,2,3,4,5] }, expected: [5,4,3,2,1], isLinkedList: true },
      { input: { head: [1,2] }, expected: [2,1], isLinkedList: true },
      { input: { head: [] }, expected: [], isLinkedList: true },
      { input: { head: [1] }, expected: [1], isLinkedList: true }
    ],
    hints: [
      "Think about what pointers you need to keep track of during reversal.",
      "You need three pointers: previous, current, and next.",
      "At each step: save next, reverse the link, move pointers forward.",
      "Consider the iterative approach first, then try recursive if you're comfortable."
    ],
    solution: `function reverseList(head) {
  let prev = null;
  let current = head;
  
  while (current !== null) {
    const next = current.next;  // Save next node
    current.next = prev;         // Reverse the link
    prev = current;              // Move prev forward
    current = next;              // Move current forward
  }
  
  return prev;  // prev is now the new head
}

// Recursive solution:
function reverseListRecursive(head) {
  if (head === null || head.next === null) {
    return head;
  }
  
  const newHead = reverseListRecursive(head.next);
  head.next.next = head;
  head.next = null;
  
  return newHead;
}`,
    solutionExplanation: `**Approach: Iterative with Three Pointers**

1. Initialize \`prev\` as null and \`current\` as head
2. While current is not null:
   - Save the next node
   - Reverse the link (current.next = prev)
   - Move prev and current one step forward
3. Return prev as the new head

**Time Complexity:** O(n) - visit each node once
**Space Complexity:** O(1) - only using pointers`,
    timeLimit: 20 * 60,
    optimalComplexity: "O(n)"
  },
  {
    id: "maximum-subarray",
    title: "Maximum Subarray",
    difficulty: "Medium",
    category: "Dynamic Programming",
    description: `Given an integer array \`nums\`, find the subarray with the largest sum, and return its sum.

A **subarray** is a contiguous non-empty sequence of elements within an array.`,
    examples: [
      {
        input: "nums = [-2,1,-3,4,-1,2,1,-5,4]",
        output: "6",
        explanation: "The subarray [4,-1,2,1] has the largest sum 6."
      },
      {
        input: "nums = [1]",
        output: "1",
        explanation: "The subarray [1] has the largest sum 1."
      },
      {
        input: "nums = [5,4,-1,7,8]",
        output: "23",
        explanation: "The subarray [5,4,-1,7,8] has the largest sum 23."
      }
    ],
    constraints: [
      "1 <= nums.length <= 10^5",
      "-10^4 <= nums[i] <= 10^4"
    ],
    starterCode: `function maxSubArray(nums) {
  // Your solution here
}`,
    testCases: [
      { input: { nums: [-2,1,-3,4,-1,2,1,-5,4] }, expected: 6 },
      { input: { nums: [1] }, expected: 1 },
      { input: { nums: [5,4,-1,7,8] }, expected: 23 },
      { input: { nums: [-1] }, expected: -1 },
      { input: { nums: [-2,-1] }, expected: -1 }
    ],
    hints: [
      "A brute force approach checks all subarrays. Can you do better?",
      "Think about this: at each position, should you extend the previous subarray or start fresh?",
      "This is Kadane's algorithm: keep track of current sum and max sum.",
      "If current sum becomes negative, reset it to 0 (start fresh from next element)."
    ],
    solution: `function maxSubArray(nums) {
  let maxSum = nums[0];
  let currentSum = nums[0];
  
  for (let i = 1; i < nums.length; i++) {
    // Either extend previous subarray or start new one
    currentSum = Math.max(nums[i], currentSum + nums[i]);
    maxSum = Math.max(maxSum, currentSum);
  }
  
  return maxSum;
}`,
    solutionExplanation: `**Approach: Kadane's Algorithm**

1. Initialize maxSum and currentSum with the first element
2. For each subsequent element, decide:
   - Extend the current subarray (currentSum + nums[i])
   - Or start a new subarray (nums[i])
3. Update maxSum if currentSum is larger

**Time Complexity:** O(n) - single pass
**Space Complexity:** O(1) - only tracking two variables`,
    timeLimit: 30 * 60,
    optimalComplexity: "O(n)"
  },
  {
    id: "binary-search",
    title: "Binary Search",
    difficulty: "Easy",
    category: "Binary Search",
    description: `Given an array of integers \`nums\` which is sorted in ascending order, and an integer \`target\`, write a function to search \`target\` in \`nums\`. If \`target\` exists, then return its index. Otherwise, return \`-1\`.

You must write an algorithm with O(log n) runtime complexity.`,
    examples: [
      {
        input: "nums = [-1,0,3,5,9,12], target = 9",
        output: "4",
        explanation: "9 exists in nums and its index is 4."
      },
      {
        input: "nums = [-1,0,3,5,9,12], target = 2",
        output: "-1",
        explanation: "2 does not exist in nums so return -1."
      }
    ],
    constraints: [
      "1 <= nums.length <= 10^4",
      "-10^4 < nums[i], target < 10^4",
      "All the integers in nums are unique",
      "nums is sorted in ascending order"
    ],
    starterCode: `function search(nums, target) {
  // Your solution here
}`,
    testCases: [
      { input: { nums: [-1,0,3,5,9,12], target: 9 }, expected: 4 },
      { input: { nums: [-1,0,3,5,9,12], target: 2 }, expected: -1 },
      { input: { nums: [5], target: 5 }, expected: 0 },
      { input: { nums: [2,5], target: 5 }, expected: 1 },
      { input: { nums: [2,5], target: 2 }, expected: 0 }
    ],
    hints: [
      "Binary search works by repeatedly dividing the search space in half.",
      "Use two pointers: left and right to define the current search range.",
      "Compare the middle element with target to decide which half to search next.",
      "Be careful with the mid calculation to avoid integer overflow: use left + (right - left) / 2."
    ],
    solution: `function search(nums, target) {
  let left = 0;
  let right = nums.length - 1;
  
  while (left <= right) {
    const mid = Math.floor(left + (right - left) / 2);
    
    if (nums[mid] === target) {
      return mid;
    } else if (nums[mid] < target) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  
  return -1;
}`,
    solutionExplanation: `**Approach: Binary Search**

1. Initialize left = 0 and right = length - 1
2. While left <= right:
   - Calculate mid index
   - If nums[mid] equals target, return mid
   - If nums[mid] < target, search right half (left = mid + 1)
   - Otherwise, search left half (right = mid - 1)
3. Return -1 if not found

**Time Complexity:** O(log n) - halving search space each iteration
**Space Complexity:** O(1) - only using pointers`,
    timeLimit: 20 * 60,
    optimalComplexity: "O(log n)"
  },
  {
    id: "climbing-stairs",
    title: "Climbing Stairs",
    difficulty: "Easy",
    category: "Dynamic Programming",
    description: `You are climbing a staircase. It takes \`n\` steps to reach the top.

Each time you can either climb 1 or 2 steps. In how many distinct ways can you climb to the top?`,
    examples: [
      {
        input: "n = 2",
        output: "2",
        explanation: "There are two ways: (1) 1 step + 1 step, (2) 2 steps."
      },
      {
        input: "n = 3",
        output: "3",
        explanation: "There are three ways: (1) 1+1+1, (2) 1+2, (3) 2+1."
      }
    ],
    constraints: [
      "1 <= n <= 45"
    ],
    starterCode: `function climbStairs(n) {
  // Your solution here
}`,
    testCases: [
      { input: { n: 2 }, expected: 2 },
      { input: { n: 3 }, expected: 3 },
      { input: { n: 4 }, expected: 5 },
      { input: { n: 5 }, expected: 8 },
      { input: { n: 1 }, expected: 1 }
    ],
    hints: [
      "Think about how you can reach step n. From which steps can you arrive there?",
      "You can reach step n from step n-1 (one step) or step n-2 (two steps).",
      "This means: ways(n) = ways(n-1) + ways(n-2). Does this remind you of something?",
      "It's the Fibonacci sequence! You can solve it iteratively to avoid recursion overhead."
    ],
    solution: `function climbStairs(n) {
  if (n <= 2) return n;
  
  let prev2 = 1;  // ways to climb 1 step
  let prev1 = 2;  // ways to climb 2 steps
  
  for (let i = 3; i <= n; i++) {
    const current = prev1 + prev2;
    prev2 = prev1;
    prev1 = current;
  }
  
  return prev1;
}`,
    solutionExplanation: `**Approach: Dynamic Programming (Fibonacci)**

The number of ways to reach step n is the sum of ways to reach step n-1 and n-2.

1. Base cases: 1 way for step 1, 2 ways for step 2
2. For each step from 3 to n, calculate ways = ways(n-1) + ways(n-2)
3. Only keep track of the last two values to save space

**Time Complexity:** O(n) - single iteration
**Space Complexity:** O(1) - only tracking two variables`,
    timeLimit: 20 * 60,
    optimalComplexity: "O(n)"
  },
  {
    id: "contains-duplicate",
    title: "Contains Duplicate",
    difficulty: "Easy",
    category: "Arrays & Hashing",
    description: `Given an integer array \`nums\`, return \`true\` if any value appears **at least twice** in the array, and return \`false\` if every element is distinct.`,
    examples: [
      {
        input: "nums = [1,2,3,1]",
        output: "true",
        explanation: "1 appears twice."
      },
      {
        input: "nums = [1,2,3,4]",
        output: "false",
        explanation: "All elements are distinct."
      },
      {
        input: "nums = [1,1,1,3,3,4,3,2,4,2]",
        output: "true",
        explanation: "Multiple duplicates exist."
      }
    ],
    constraints: [
      "1 <= nums.length <= 10^5",
      "-10^9 <= nums[i] <= 10^9"
    ],
    starterCode: `function containsDuplicate(nums) {
  // Your solution here
}`,
    testCases: [
      { input: { nums: [1,2,3,1] }, expected: true },
      { input: { nums: [1,2,3,4] }, expected: false },
      { input: { nums: [1,1,1,3,3,4,3,2,4,2] }, expected: true },
      { input: { nums: [1] }, expected: false },
      { input: { nums: [1,1] }, expected: true }
    ],
    hints: [
      "A brute force approach would compare every pair. What's the time complexity?",
      "Can you use extra space to achieve better time complexity?",
      "A Set automatically handles uniqueness. What happens when you add a duplicate?",
      "Compare the Set size with array length, or check if element exists before adding."
    ],
    solution: `function containsDuplicate(nums) {
  const seen = new Set();
  
  for (const num of nums) {
    if (seen.has(num)) {
      return true;
    }
    seen.add(num);
  }
  
  return false;
}

// Alternative one-liner:
// return new Set(nums).size !== nums.length;`,
    solutionExplanation: `**Approach: Hash Set**

1. Create a Set to track seen numbers
2. For each number:
   - If it's already in the Set, we found a duplicate
   - Otherwise, add it to the Set
3. Return false if no duplicates found

**Time Complexity:** O(n) - single pass with O(1) Set operations
**Space Complexity:** O(n) - Set storage`,
    timeLimit: 15 * 60,
    optimalComplexity: "O(n)"
  }
];

// Helper to get problem by ID
export const getProblemById = (id) => PROBLEMS.find(p => p.id === id);

// Get problems by difficulty
export const getProblemsByDifficulty = (difficulty) => 
  PROBLEMS.filter(p => p.difficulty === difficulty);

// Get problems by category
export const getProblemsByCategory = (category) =>
  PROBLEMS.filter(p => p.category === category);

// Get all unique categories
export const getCategories = () => 
  [...new Set(PROBLEMS.map(p => p.category))];

// Get all unique difficulties
export const getDifficulties = () => 
  [...new Set(PROBLEMS.map(p => p.difficulty))];

export default PROBLEMS;
