// The checks of src/display.js: one sentence each, the sentences almanac.json lists.
import * as A from '../../src/index.js';
import { assert, canvas, pixel, pixels } from '../helpers.mjs';

export const CHECKS = [
  {
    entry: 'drawList',
    says: 'it draws exactly what the same canvas calls draw, pixel for pixel, for every kind of shape, paint and group',
    run() {
      const by = (draw) => {
        const g = canvas(160, 120, '#f4efe6');
        draw(g);
        return pixels(g, 160, 120);
      };
      const list = by((g) =>
        A.drawList(g, [
          {
            path: [
              ['moveTo', 10, 10],
              ['lineTo', 60, 30],
              ['quadraticCurveTo', 80, 0, 100, 30],
            ],
            stroke: '#204060',
            width: 3,
            cap: 'round',
            join: 'round',
          },
          {
            path: [['ellipse', 40, 70, 20, 10, 0.3, 0, Math.PI * 2]],
            fill: {
              linear: [20, 60, 60, 80],
              stops: [
                [0, '#ff8040'],
                [1, '#402010'],
              ],
            },
          },
          { rect: [90, 50, 30, 20], fill: 'rgba(0,128,64,0.7)' },
          {
            path: [
              ['roundRect', 120, 80, 30, 25, 6],
              ['arc', 70, 100, 12, 0, Math.PI * 2],
            ],
            fill: '#8040a0',
            fillRule: 'evenodd',
          },
          {
            group: [
              {
                path: [['moveTo', 0, 0], ['lineTo', 20, 0], ['lineTo', 0, 15], ['closePath']],
                fill: {
                  radial: [5, 5, 0, 5, 5, 20],
                  stops: [
                    [0, '#fff'],
                    [1, '#00f'],
                  ],
                },
              },
            ],
            translate: [130, 20],
            scale: [-1, 1],
            rotate: 0.4,
            composite: 'multiply',
            shadow: { color: 'rgba(0,0,0,0.5)', blur: 4 },
          },
        ]),
      );
      const calls = by((g) => {
        g.strokeStyle = '#204060';
        g.lineWidth = 3;
        g.lineCap = 'round';
        g.lineJoin = 'round';
        g.beginPath();
        g.moveTo(10, 10);
        g.lineTo(60, 30);
        g.quadraticCurveTo(80, 0, 100, 30);
        g.stroke();
        const lg = g.createLinearGradient(20, 60, 60, 80);
        lg.addColorStop(0, '#ff8040');
        lg.addColorStop(1, '#402010');
        g.fillStyle = lg;
        g.beginPath();
        g.ellipse(40, 70, 20, 10, 0.3, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(0,128,64,0.7)';
        g.fillRect(90, 50, 30, 20);
        g.fillStyle = '#8040a0';
        g.beginPath();
        g.roundRect(120, 80, 30, 25, 6);
        g.arc(70, 100, 12, 0, Math.PI * 2);
        g.fill('evenodd');
        g.save();
        g.translate(130, 20);
        g.scale(-1, 1);
        g.rotate(0.4);
        g.globalCompositeOperation = 'multiply';
        g.shadowColor = 'rgba(0,0,0,0.5)';
        g.shadowBlur = 4;
        const rg = g.createRadialGradient(5, 5, 0, 5, 5, 20);
        rg.addColorStop(0, '#fff');
        rg.addColorStop(1, '#00f');
        g.fillStyle = rg;
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(20, 0);
        g.lineTo(0, 15);
        g.closePath();
        g.fill();
        g.restore();
      });
      assert.equal(list, calls);
    },
  },
  {
    entry: 'drawList',
    says: "a group's moves, blending and shadow end with it, and what an item leaves out stays as the canvas has it",
    run() {
      const g = canvas(100, 100, '#ffffff');
      g.lineWidth = 7;
      g.lineCap = 'round';
      A.drawList(g, [
        {
          group: [{ rect: [0, 0, 10, 10], fill: '#000' }],
          translate: [50, 50],
          composite: 'multiply',
          shadow: { color: '#f00', blur: 3 },
        },
        {
          path: [
            ['moveTo', 10, 80],
            ['lineTo', 90, 80],
          ],
          stroke: '#000',
        },
      ]);
      assert.equal(g.globalCompositeOperation, 'source-over');
      assert.equal(g.shadowBlur, 0);
      assert.deepEqual(g.getTransform().e, 0);
      assert.equal(g.lineWidth, 7, 'the line kept the width the canvas had');
      assert.equal(g.lineCap, 'round');
      // a round end reaches 3.5 past the line's end (x 6.5), and the line is 7 wide (y 76.5 to 83.5)
      assert.ok(pixel(g, 8, 80)[0] < 50 && pixel(g, 50, 77)[0] < 50, 'the stroke 7 wide, with round ends');
      assert.ok(pixel(g, 55, 55)[0] < 50 && pixel(g, 5, 5)[0] > 200, 'the group drawn at its place, and only there');
    },
  },
  {
    entry: 'drawList',
    says: 'empty items are skipped, and an unknown path command is refused with a message naming the commands',
    run() {
      const g = canvas(20, 20, '#fff');
      A.drawList(g, [null, false, undefined]);
      assert.throws(
        () => A.drawList(g, [{ path: [['drawImage', 0, 0]], fill: '#000' }]),
        /"drawImage" is not a path command \(one of: moveTo, lineTo/,
      );
    },
  },
  {
    entry: 'drawList',
    says: "a group's clip limits what is drawn in it to the inside of its path",
    run() {
      const g = canvas(100, 100, '#ffffff');
      A.drawList(g, [
        { clip: [['rect', 20, 20, 30, 30]], group: [{ rect: [0, 0, 100, 100], fill: '#000000' }] },
        { rect: [80, 80, 10, 10], fill: '#000000' },
      ]);
      assert.ok(
        pixel(g, 35, 35)[0] < 20 && pixel(g, 10, 10)[0] > 240 && pixel(g, 60, 60)[0] > 240,
        'black only inside the clip',
      );
      assert.ok(pixel(g, 85, 85)[0] < 20, 'the clip ends with its group');
    },
  },
];
