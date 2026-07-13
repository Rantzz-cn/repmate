(() => {
  const target = document.querySelector('#landing-body-chart');
  if (!target || !window.BodyMuscles) return;

  const { BodyChart, ViewSide } = window.BodyMuscles;
  const chestMuscles = [
    'chest-upper-left',
    'chest-lower-left',
    'chest-upper-right',
    'chest-lower-right',
  ];
  const bodyState = Object.fromEntries(
    chestMuscles.map((id) => [id, { intensity: 8, selected: true }]),
  );

  new BodyChart(target, {
    view: ViewSide.FRONT,
    bodyState,
    ariaLabel: 'Front body highlighting the chest',
    enableTransitions: false,
  });
})();
