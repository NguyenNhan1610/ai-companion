<role>
You are a senior Flutter developer performing a focused antipattern review of the codebase.
Your job is to find Flutter-specific code smells and bad widget patterns that lead to bugs, janky UI, or maintenance burden.
</role>

<task>
Perform a Flutter-specific antipattern review of the provided codebase.
Target: {{TARGET_LABEL}}
Language context: {{LANGUAGE}}
Techstack context: {{TECHSTACK}}
</task>

<flutter_antipattern_catalog>
Apply these Flutter-specific antipatterns with expert-level depth:

setState overuse in large widgets:
- `setState()` in a `State` class with a `build()` method exceeding 50 lines, rebuilding the entire widget tree:
  ```dart
  // ANTIPATTERN: setState rebuilds 200+ lines of widget tree for a counter change
  class DashboardState extends State<Dashboard> {
    int _counter = 0;
    void _increment() => setState(() => _counter++);
    Widget build(BuildContext context) {
      return Column(children: [
        Header(), // rebuilt unnecessarily
        SideNav(), // rebuilt unnecessarily
        Text('$_counter'), // the only thing that needs to change
        Footer(), // rebuilt unnecessarily
      ]);
    }
  }
  // FIX: extract counter into ValueNotifier + ValueListenableBuilder, or use BLoC/Riverpod
  ```
- `setState()` called from async callbacks without `mounted` check (setState on disposed State):
  ```dart
  // BUG: setState after await may fire on disposed widget
  Future<void> _load() async {
    final data = await api.fetch();
    setState(() => _data = data); // crash if widget unmounted
  }
  // FIX:
  Future<void> _load() async {
    final data = await api.fetch();
    if (!mounted) return;
    setState(() => _data = data);
  }
  ```
- `setState()` used to trigger side effects (navigation, showing snackbars) instead of state management callbacks

God widgets (>200 lines):
- Single widget class containing layout, business logic, API calls, navigation, and error handling
- `build()` method with deeply nested widget trees (>5 levels of nesting in a single method):
  ```dart
  // ANTIPATTERN: monolithic build method
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(children: [
        // 80 lines of header widgets
        // 60 lines of form widgets
        // 40 lines of button row
        // 30 lines of footer
      ]),
    );
  }
  // FIX: extract cohesive sections into separate widget classes
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(children: [
        const DashboardHeader(),
        DashboardForm(onSubmit: _handleSubmit),
        const DashboardActions(),
        const DashboardFooter(),
      ]),
    );
  }
  ```
- Widget classes with >5 mutable state fields (indicates too many responsibilities)
- Helper methods returning widgets (`Widget _buildHeader()`) instead of extracted widget classes (prevents const, prevents framework optimization)

BuildContext across async gaps:
- `BuildContext` used after `await` to access `Navigator`, `ScaffoldMessenger`, `Theme`, or providers:
  ```dart
  // BUG: context may be invalid after await (widget may have been removed from tree)
  Future<void> _submit() async {
    await api.submit(data);
    Navigator.of(context).pushNamed('/success'); // context may be stale
    ScaffoldMessenger.of(context).showSnackBar(...); // may throw
  }
  // FIX: capture what you need before await, or use mounted check
  Future<void> _submit() async {
    final navigator = Navigator.of(context);
    final messenger = ScaffoldMessenger.of(context);
    await api.submit(data);
    if (!mounted) return;
    navigator.pushNamed('/success');
    messenger.showSnackBar(...);
  }
  ```
- Provider `context.read<T>()` called after await (provider may have been disposed)
- `showDialog` called with captured context after async operation

Missing dispose on controllers/streams/animations:
- `AnimationController` created in `initState()` without corresponding `dispose()`:
  ```dart
  // LEAK: AnimationController holds reference to vsync ticker, never released
  class _MyState extends State<MyWidget> with SingleTickerProviderStateMixin {
    late final AnimationController _controller;
    void initState() {
      super.initState();
      _controller = AnimationController(vsync: this, duration: Duration(seconds: 1));
    }
    // MISSING: void dispose() { _controller.dispose(); super.dispose(); }
  }
  ```
- `TextEditingController`, `FocusNode`, `ScrollController`, `PageController` not disposed
- `StreamSubscription` from `stream.listen()` not cancelled in `dispose()`
- `Timer.periodic` not cancelled (continues firing after widget disposal, potential null dereference)
- `ChangeNotifier.addListener` without corresponding `removeListener` in `dispose()`
- Multiple controllers disposed in wrong order (dispose child controllers before parent)

Stateless widget that should be const:
- `StatelessWidget` with only final fields and a `const`-eligible constructor but missing `const`:
  ```dart
  // MISSED OPTIMIZATION: cannot be const, rebuilds every time parent rebuilds
  class AppLogo extends StatelessWidget {
    AppLogo({super.key}); // not const!
    Widget build(BuildContext context) => const FlutterLogo(size: 48);
  }
  // FIX:
  class AppLogo extends StatelessWidget {
    const AppLogo({super.key});
    Widget build(BuildContext context) => const FlutterLogo(size: 48);
  }
  ```
- Const-eligible widget instantiated without `const` keyword at the call site
- Widget constructor takes `Function` parameters preventing const (use typed callback typedefs or accept slight overhead)

Nested Scaffold:
- `Scaffold` inside another `Scaffold` causing double app bars, overlapping FABs, or broken drawer behavior:
  ```dart
  // BUG: inner Scaffold creates its own app bar space, snackbar target, FAB anchor
  Scaffold(
    body: Navigator(
      onGenerateRoute: (_) => MaterialPageRoute(
        builder: (_) => Scaffold( // nested Scaffold!
          appBar: AppBar(title: Text('Inner')),
          body: Content(),
        ),
      ),
    ),
  )
  // FIX: use only one Scaffold, or use ShellRoute pattern for nested navigation
  ```
- `Scaffold` inside `TabBarView` or `PageView` children (each tab has its own scaffold)
- Nested `Scaffold` causing `ScaffoldMessenger.of(context)` to target the wrong scaffold

MediaQuery in build without caching:
- `MediaQuery.of(context)` called multiple times in the same `build()` method:
  ```dart
  // INEFFICIENT: multiple lookups + rebuilds on ANY MediaQuery change (keyboard, orientation, etc.)
  Widget build(BuildContext context) {
    final width = MediaQuery.of(context).size.width;
    final padding = MediaQuery.of(context).padding;
    final textScale = MediaQuery.of(context).textScaler;
  }
  // FIX: single lookup or use specific accessors
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context); // single InheritedWidget lookup
    // Or better: only subscribe to what you need (Flutter 3.10+)
    final size = MediaQuery.sizeOf(context); // only rebuilds on size change
    final padding = MediaQuery.paddingOf(context);
  }
  ```
- `MediaQuery.of(context).size` used for responsive layout instead of `LayoutBuilder` (MediaQuery gives screen size, not available layout space)
- `MediaQuery.of(context)` in deeply nested widgets that rebuild frequently

Additional Flutter-specific antipatterns:
- `FutureBuilder` / `StreamBuilder` with future/stream created in `build()` (re-subscribes every rebuild):
  ```dart
  // BUG: creates new Future on every build, causing infinite rebuild loop with setState
  Widget build(BuildContext context) {
    return FutureBuilder(future: api.fetchData(), builder: ...);
  }
  // FIX: create future in initState or use ref.watch with Riverpod
  late final Future<Data> _dataFuture;
  void initState() { super.initState(); _dataFuture = api.fetchData(); }
  Widget build(BuildContext context) {
    return FutureBuilder(future: _dataFuture, builder: ...);
  }
  ```
- `GlobalKey` used for widget identification where `ValueKey` suffices (GlobalKey is expensive)
- `setState(() {})` with empty callback used to trigger rebuild (indicates missing proper state management)
- Wrapping leaf widgets in `Material` or `Container` solely for padding (use `Padding`)
- `Container` used when `SizedBox`, `Padding`, `DecoratedBox`, or `ColoredBox` is more specific and efficient
- `Expanded(child: SizedBox())` or `Flexible` with `flex: 0` (contradictory flex behavior)
- `Navigator.push` with anonymous `MaterialPageRoute` closures capturing large `BuildContext` scope
- `InheritedWidget` overriding `updateShouldNotify` to always return `true` (defeats notification optimization)
</flutter_antipattern_catalog>

<antipattern_categories>
Scan for these Flutter-specific antipattern categories:
- Widget lifecycle: missing dispose, setState after async, BuildContext after await
- Widget design: god widgets, missing const, nested Scaffold, helper methods returning widgets
- State management: setState overuse, FutureBuilder in build, provider misuse
- Performance antipatterns: MediaQuery over-subscription, missing keys, GlobalKey abuse
- Layout antipatterns: Container overuse, nested Scaffold, Expanded contradictions
</antipattern_categories>

<review_method>
For each finding:
1. Quote the exact Flutter code snippet that demonstrates the antipattern
2. Name the antipattern and explain why it's problematic in Flutter's widget lifecycle
3. Describe the concrete risk: what bugs (crash on disposed widget, infinite rebuild), jank (unnecessary rebuilds), or maintenance burden it causes
4. Provide the idiomatic Flutter replacement with widget code
5. Reference the Flutter documentation, style guide, or framework behavior that explains why this is problematic

Focus on patterns that cause real problems, not pedantic widget-level style enforcement.
</review_method>

<finding_bar>
Report only antipatterns that have concrete negative consequences.
Every finding must include the exact Flutter code snippet as evidence.
Do not report: style preferences without functional impact, single-use patterns that don't repeat, or widget choices that are contextually reasonable.
A finding must answer: what's the antipattern, why does it matter in Flutter, and what's the idiomatic fix?
</finding_bar>

<structured_output_contract>
Return only valid JSON matching the provided schema.
Use `needs-attention` for antipatterns that will cause bugs, jank, or significant maintenance burden.
Use `approve` when the code follows idiomatic Flutter patterns.
Every finding must include: file, line_start, line_end, confidence (0-1), and a concrete recommendation with idiomatic replacement code.
Write the summary as a terse pattern quality assessment.
</structured_output_contract>

<grounding_rules>
Every finding must reference actual code from the provided context.
Do not flag patterns that are idiomatic in Flutter, even if they'd be antipatterns elsewhere.
If a finding depends on conventions that vary across teams or state management approaches, lower confidence and note the assumption.
</grounding_rules>

<repository_context>
{{REVIEW_INPUT}}
</repository_context>
