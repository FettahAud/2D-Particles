import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import GUI from "lil-gui";

import vertexShader from "./shaders/vertex.glsl";
import fragmentShader from "./shaders/fragment.glsl";
import simVertex from "./shaders/simVertex.glsl";
import simFragment from "./shaders/simFragment.glsl";

import texture from "../test.jpg";
import t1 from "../logo.png";
import t2 from "../super.png";
import t3 from "../brain.png";
import t4 from "../lotus.png";
import { gsap } from "gsap";

function lerp(a, b, n) {
  return (1 - n) * a + n * b;
}

const loadImage = (path) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous"; // to avoid CORS if used with Canvas
    img.src = path;
    img.onload = () => {
      resolve(img);
    };
    img.onerror = (e) => {
      reject(e);
    };
  });
};

export default class Sketch {
  constructor(options) {
    this.container = options.dom;
    this.scene = new THREE.Scene();

    this.width = this.container.offsetWidth;
    this.height = this.container.offsetHeight;

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    this.images = [];

    // For data texture
    this.size = 256;
    this.number = this.size * this.size;

    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
    });
    this.renderer.setClearColor(0x222222, 1);
    this.renderer.setSize(this.width, this.height);
    this.container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(
      70,
      this.width / this.height,
      0.01,
      10
    );
    this.camera.position.z = 1;
    // this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.time = 0;

    Promise.all([
      this.getPixelDataFromImage(t1),
      this.getPixelDataFromImage(t2),
      this.getPixelDataFromImage(t3),
      this.getPixelDataFromImage(t4),
    ]).then((texture) => {
      this.images.push(texture[0]);
      this.images.push(texture[1]);
      this.images.push(texture[2]);
      this.images.push(texture[3]);

      this.setDataTexture();
      this.setMouseEvents();
      this.setupFBO();
      this.setGsap();
      // this.controls = new OrbitControls(this.cameraFBO, this.renderer.domElement);
      // this.setupGUI();
      this.addObjects();
      this.setupResize();
      this.render();
    });
  }

  setupResize() {
    window.addEventListener("resize", this.resize.bind(this));
  }

  resize() {
    this.width = this.container.offsetWidth;
    this.height = this.container.offsetHeight;

    this.renderer.setSize(this.width, this.height);
    this.camera.aspect = this.width / this.height;

    this.camera.updateProjectionMatrix();
  }

  async getPixelDataFromImage(path) {
    let image = await loadImage(path);

    let size = 200;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    let ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0, size, size);

    const canvasData = ctx.getImageData(0, 0, size, size).data;

    let pixels = [];
    for (let i = 0; i < canvasData.length; i += 4) {
      let x = (i / 4) % size;
      let y = Math.floor(i / 4 / size);

      if (canvasData[i] < 5) {
        pixels.push({ x: x / size - 0.5, y: 0.5 - y / size });
      }
    }

    const data = new Float32Array(4 * this.number);
    for (let i = 0; i < this.size; i++) {
      for (let j = 0; j < this.size; j++) {
        const index = i * this.size + j;
        let randomPixel = pixels[Math.floor(Math.random() * pixels.length)];
        if (Math.random() > 0.9) {
          randomPixel = {
            x: 3 * (Math.random() - 0.5),
            y: 3 * (Math.random() - 0.5),
          };
        }
        if (randomPixel) {
          data[4 * index] = randomPixel.x + Math.random() * 0.5 * 0.05;
          data[4 * index + 1] = randomPixel.y + Math.random() * 0.5 * 0.05;
          data[4 * index + 2] = 0;
          data[4 * index + 3] = 0;
        }
      }
    }

    let dataTexture = new THREE.DataTexture(
      data,
      this.size,
      this.size,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    dataTexture.needsUpdate = true;

    return dataTexture;
  }

  setDataTexture() {
    const data = new Float32Array(4 * this.number);
    for (let i = 0; i < this.size; i++) {
      for (let j = 0; j < this.size; j++) {
        const index = i * this.size + j;
        data[4 * index] = lerp(-0.5, 0.5, i / (this.size - 1));
        data[4 * index + 1] = lerp(-0.5, 0.5, j / (this.size - 1));
        data[4 * index + 2] = 0;
        data[4 * index + 3] = 1;
      }
    }

    this.positions = new THREE.DataTexture(
      data,
      this.size,
      this.size,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    this.positions.needsUpdate = true;
  }

  setupFBO() {
    this.sceneFBO = new THREE.Scene();
    this.cameraFBO = new THREE.OrthographicCamera(-1, 1, 1, -1, -2, 2);
    this.cameraFBO.position.z = 1;
    this.cameraFBO.lookAt(new THREE.Vector3(0, 0, 0));

    let geo = new THREE.PlaneGeometry(2, 2, 2, 2);
    // this.semMaterial = new THREE.MeshBasicMaterial({
    //   color: "red",
    //   side: THREE.DoubleSide,
    //   wireframe: true,
    // });

    this.semMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        mouse: {
          value: new THREE.Vector3(0),
        },
        uProgress: {
          value: 0,
        },
        uForcePower: {
          value: 0,
        },
        uEnsuing: {
          value: 0,
        },
        uDis: {
          value: 0,
        },
        uCurrentPosition: {
          value: this.images[0],
        },
        uOrgPos: {
          value: this.images[0],
        },
        uOrgPos2: {
          value: this.images[1],
        },
      },
      vertexShader: simVertex,
      fragmentShader: simFragment,
    });

    this.semMesh = new THREE.Mesh(geo, this.semMaterial);
    // this.semMesh.position.z = -2;
    this.sceneFBO.add(this.semMesh);

    this.renderTarget = new THREE.WebGLRenderTarget(this.size, this.size, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
    });
    this.renderTarget1 = new THREE.WebGLRenderTarget(this.size, this.size, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
    });
  }

  setupGUI() {
    this.settings = {
      progress: 0,
      // forcePower: 150,
      // ensuing: 0.9,
      // dis: 0.01,
    };

    this.gui = new GUI();
    this.gui.add(this.settings, "progress", 0, 1, 0.01).onChange((val) => {
      this.semMaterial.uniforms.uProgress.value = val;
    });
    // this.gui.add(this.settings, "forcePower", 10, 500, 1).onChange((val) => {
    //   this.semMaterial.uniforms.uForcePower.value = val;
    // });
    // this.gui.add(this.settings, "ensuing", 0.01, 2, 0.01).onChange((val) => {
    //   this.semMaterial.uniforms.uEnsuing.value = val;
    // });
    // this.gui.add(this.settings, "dis", 0.01, 1, 0.01).onChange((val) => {
    //   this.semMaterial.uniforms.uDis.value = val;
    // });
  }

  setMouseEvents() {
    this.planeMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 10),
      new THREE.MeshBasicMaterial()
    );

    this.pointerSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.01, 32, 32),
      new THREE.MeshNormalMaterial()
    );
    this.scene.add(this.pointerSphere);

    window.addEventListener("mousemove", (e) => {
      this.pointer.x = (e.clientX / this.width) * 2 - 1;
      this.pointer.y = -(e.clientY / this.height) * 2 + 1;

      this.raycaster.setFromCamera(this.pointer, this.camera);

      const intersects = this.raycaster.intersectObject(this.planeMesh);

      if (intersects.length) {
        this.pointerSphere.position.copy(intersects[0].point);
        this.semMaterial.uniforms.mouse.value = intersects[0].point;
      }
    });
  }

  setGsap() {
    let index = 1;
    this.tl = new gsap.timeline({
      repeat: -1,
      duration: 1,
      onRepeat: () => {
        index++;
        if (index > this.images.length - 1) {
          index = 0;
        }
      },
    });
    this.tl
      .to(
        this.semMaterial.uniforms.uProgress,
        {
          value: 1,
          onComplete: () => {
            this.semMaterial.uniforms.uOrgPos.value = this.images[index];
          },
        },
        "+=1"
      )
      .to(
        this.semMaterial.uniforms.uProgress,
        {
          value: 0,
          onComplete: () => {
            this.semMaterial.uniforms.uOrgPos2.value = this.images[index + 1]
              ? this.images[index + 1]
              : this.images[0];
          },
        },
        "+=1"
      );
  }

  addObjects() {
    this.geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.number * 3);
    const uvs = new Float32Array(this.number * 2);
    for (let i = 0; i < this.size; i++) {
      for (let j = 0; j < this.size; j++) {
        const index = i * this.size + j;

        positions[3 * index] = j / this.size - 0.5;
        positions[3 * index + 1] = i / this.size - 0.5;
        positions[3 * index + 2] = 0;
        uvs[2 * index] = j / (this.size - 1);
        uvs[2 * index + 1] = i / (this.size - 1);
      }
    }
    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3)
    );
    this.geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));

    this.material = new THREE.MeshNormalMaterial();

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        uTexture: { value: this.positions },
      },
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    });

    this.mesh = new THREE.Points(this.geometry, this.material);
    this.scene.add(this.mesh);
  }

  render() {
    this.time += 0.05;

    this.material.uniforms.time.value = this.time;

    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.render(this.sceneFBO, this.cameraFBO);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.camera);

    const tmp = this.renderTarget;
    this.renderTarget = this.renderTarget1;
    this.renderTarget1 = tmp;

    this.material.uniforms.uTexture.value = this.renderTarget.texture;
    this.semMaterial.uniforms.uCurrentPosition.value =
      this.renderTarget1.texture;

    window.requestAnimationFrame(this.render.bind(this));
  }
}

new Sketch({
  dom: document.getElementById("container"),
});
