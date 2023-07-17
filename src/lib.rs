use {
    rapier2d::prelude::*,
    wasm_bindgen::prelude::*,
    web_sys::{CanvasRenderingContext2d, HtmlCanvasElement},
};

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[allow(unused_macros)]
macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

pub fn set_panic_hook() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub struct Universe {
    words: Vec<WordBox>,
    ctx: CanvasRenderingContext2d,

    // simulation ingredients
    gravity: Vector<Real>,
    physics_pipeline: PhysicsPipeline,
    integration_params: IntegrationParameters,
    island_manager: IslandManager,
    broad_phase: BroadPhase,
    narrow_phase: NarrowPhase,
    rigid_bodies: RigidBodySet,
    colliders: ColliderSet,
    impulse_joints: ImpulseJointSet,
    multibody_joints: MultibodyJointSet,
    ccd_solver: CCDSolver,
    query_pipeline: Option<QueryPipeline>,
}

#[wasm_bindgen]
impl Universe {
    pub fn new() -> Self {
        let document = web_sys::window().unwrap().document().unwrap();
        let canvas = document.get_element_by_id("vinesweeper-canvas").unwrap();
        let canvas: HtmlCanvasElement = canvas
            .dyn_into::<HtmlCanvasElement>()
            .map_err(|_| ())
            .unwrap();

        let ctx = canvas
            .get_context("2d")
            .unwrap()
            .unwrap()
            .dyn_into::<CanvasRenderingContext2d>()
            .unwrap();
        // Match text styling to JS.
        // TODO: consider passing a style object to this constructor.
        ctx.set_text_baseline("bottom");
        ctx.set_fill_style(&JsValue::from_str("#000000"));

        Self {
            words: vec![],
            ctx: ctx,

            // Simulation ingredients
            gravity: vector![0.0, 20.0].into(), // gentle downward force
            physics_pipeline: PhysicsPipeline::new(),
            integration_params: IntegrationParameters::default(),
            island_manager: IslandManager::new(),
            broad_phase: BroadPhase::new(),
            narrow_phase: NarrowPhase::new(),
            rigid_bodies: RigidBodySet::new(),
            colliders: ColliderSet::new(),
            impulse_joints: ImpulseJointSet::new(),
            multibody_joints: MultibodyJointSet::new(),
            ccd_solver: CCDSolver::new(),
            query_pipeline: None,
        }
    }

    pub fn tick(&mut self) {
        self.step();
        for word in self.words.iter_mut() {
            word.update_coords(&mut self.rigid_bodies);
        }
        for word in self.words.iter() {
            word.render(&self.ctx);
        }
    }

    pub fn add_wall(&mut self, x_center: f32, y_center: f32, width: f32, height: f32) {
        let angle: f32 = 0.0;
        let rigid_body = RigidBodyBuilder::fixed()
            .translation(vector![x_center, y_center])
            .rotation(angle)
            .build();

        let handle = self.rigid_bodies.insert(rigid_body);
        let collider = ColliderBuilder::cuboid(width / 2.0, height / 2.0);
        self.colliders
            .insert_with_parent(collider, handle, &mut self.rigid_bodies);
    }

    pub fn add_word(&mut self, x_min: f32, y_max: f32, width: f32, height: f32, t: String) {
        let mut word = WordBox::new(x_min, y_max, width, height, t);
        let body = word.new_body();
        let collider = word.new_collider();

        let body_handle = self.rigid_bodies.insert(body);
        word.set_body_handle(body_handle);

        let collider_handle =
            self.colliders
                .insert_with_parent(collider, body_handle, &mut self.rigid_bodies);
        word.set_collider_handle(collider_handle);

        self.words.push(word);
    }
}

impl Universe {
    fn step(&mut self) {
        let physics_hooks = ();
        let event_handler = ();

        self.physics_pipeline.step(
            &self.gravity,
            &self.integration_params,
            &mut self.island_manager,
            &mut self.broad_phase,
            &mut self.narrow_phase,
            &mut self.rigid_bodies,
            &mut self.colliders,
            &mut self.impulse_joints,
            &mut self.multibody_joints,
            &mut self.ccd_solver,
            self.query_pipeline.as_mut(),
            &physics_hooks,
            &event_handler,
        );
    }
}

struct WordBox {
    x_min: f32,
    y_max: f32,
    width: f32,
    height: f32,
    angle: f32,
    text: String,

    // simulation data
    body_handle: RigidBodyHandle,
    collider_handle: ColliderHandle,
}

impl WordBox {
    fn new(x_min: f32, y_max: f32, width: f32, height: f32, text: String) -> Self {
        Self {
            x_min,
            y_max,
            width,
            height,
            angle: 0.0,
            text,

            body_handle: RigidBodyHandle::default(),
            collider_handle: ColliderHandle::default(),
        }
    }

    fn new_body(&self) -> RigidBody {
        RigidBodyBuilder::dynamic()
            .translation(vector![
                self.x_min + self.width / 2.0,
                self.y_max - self.height / 2.0
            ])
            .rotation(self.angle)
            // lots of angular damping so that most text stays horizontal
            .angular_damping(20.0)
            .ccd_enabled(false) // allow occasional overlap
            .build()
    }

    fn new_collider(&self) -> Collider {
        ColliderBuilder::cuboid(self.width / 2.0, self.height / 2.0)
            .density(self.width * self.height)
            .build()
    }

    fn set_body_handle(&mut self, handle: RigidBodyHandle) {
        self.body_handle = handle;
    }

    fn set_collider_handle(&mut self, handle: ColliderHandle) {
        self.collider_handle = handle;
    }

    fn update_coords(&mut self, bodies: &RigidBodySet) {
        let body = &bodies[self.body_handle];
        let coords = body.translation();
        self.x_min = coords.x - self.width / 2.0;
        self.y_max = coords.y + self.height / 2.0;
        self.angle = body.rotation().angle();
    }

    fn render(&self, ctx: &CanvasRenderingContext2d) {
        ctx.save();
        ctx.translate(self.x_min as f64, self.y_max as f64).unwrap();
        ctx.rotate(self.angle as f64).unwrap();
        ctx.fill_text(&self.text, 0.0, 0.0 as f64).unwrap();
        ctx.restore();
    }
}
