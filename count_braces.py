
import sys

def count_braces(filename):
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            lines = f.readlines()
    except Exception as e:
        print(f"Error reading file: {e}")
        return

    stack = []
    for i, line in enumerate(lines):
        for j, char in enumerate(line):
            if char == '{':
                stack.append((i + 1, j + 1))
            elif char == '}':
                if not stack:
                    print(f"Extra closing brace at line {i + 1}, column {j + 1}")
                else:
                    stack.pop()

    if stack:
        print(f"Unclosed braces: {len(stack)}")
        for line, col in stack:
            print(f"Unclosed brace at line {line}, column {col}")
            # Print context
            print(f"Context: {lines[line-1].strip()}")
    else:
        print("All braces balanced.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python count_braces.py <filename>")
    else:
        count_braces(sys.argv[1])
