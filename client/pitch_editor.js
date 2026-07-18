class PitchGraphEditor {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.moras = [];
        this.draggedIndex = -1;
        this.onPitchChange = null; // Callback

        this.initEvents();
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        if (!this.canvas) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.draw();
    }

    setData(accentPhrases) {
        // Flatten accent phrases to single mora list for drawing
        this.moras = [];
        accentPhrases.forEach(ap => {
            ap.moras.forEach(m => {
                this.moras.push(m);
            });
            // Add a small spacer? No, just continuous for now.
            // Or maybe mark accent boundary.
        });
        this.draw();
    }

    draw() {
        const w = this.canvas.width;
        const h = this.canvas.height;
        this.ctx.clearRect(0, 0, w, h);

        if (this.moras.length === 0) {
            this.ctx.fillStyle = "#555";
            this.ctx.font = "12px sans-serif";
            this.ctx.fillText("No audio query data selected.", 10, 20);
            return;
        }

        // Draw Guidelines
        this.ctx.strokeStyle = "#333";
        this.ctx.beginPath();
        this.ctx.moveTo(0, h / 2); this.ctx.lineTo(w, h / 2);
        this.ctx.stroke();

        // Calculate Scale
        const padding = 20;
        const stepX = (w - padding * 2) / Math.max(1, this.moras.length - 1);
        const minPitch = 3.0; // Log scale or linear? VoiceVox uses roughly 3.0 to 6.5? No, pitch is ~5.0-6.0 range usually in query.
        // Actually pitch values in query are often 0.0 (unvoiced) or ~5.5-6.0.
        // Let's assume range 0.0 to 10.0 for now, or dynamic.

        const validPitches = this.moras.filter(m => m.pitch > 0).map(m => m.pitch);
        let minP = Math.min(...validPitches, 5.0) - 0.5;
        let maxP = Math.max(...validPitches, 6.5) + 0.5;

        const getY = (pitch) => {
            if (pitch <= 0) return h - 10; // Unvoiced at bottom
            const norm = (pitch - minP) / (maxP - minP);
            return h - padding - (norm * (h - padding * 2));
        };

        // Draw Connections
        this.ctx.strokeStyle = "#96CE01";
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        let first = true;
        this.moras.forEach((m, i) => {
            if (m.pitch <= 0) return; // Skip unvoiced for line
            const x = padding + i * stepX;
            const y = getY(m.pitch);
            if (first) { this.ctx.moveTo(x, y); first = false; }
            else { this.ctx.lineTo(x, y); }
        });
        this.ctx.stroke();

        // Draw Points & Labels
        this.ctx.textAlign = 'center';
        this.ctx.font = '10px sans-serif';

        this.moras.forEach((m, i) => {
            const x = padding + i * stepX;
            const y = getY(m.pitch);

            // Point
            this.ctx.fillStyle = (m.pitch > 0) ? "#fff" : "#555";
            this.ctx.beginPath();
            this.ctx.arc(x, y, 4, 0, Math.PI * 2);
            this.ctx.fill();

            // Label
            this.ctx.fillStyle = "#aaa";
            this.ctx.fillText(m.text, x, h - 5);
        });
    }

    initEvents() {
        let isDragging = false;

        const getIndex = (evt) => {
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = evt.clientX - rect.left;
            const w = this.canvas.width;
            const padding = 20;
            const stepX = (w - padding * 2) / Math.max(1, this.moras.length - 1);

            // Fin closest index
            let closest = -1;
            let minD = 1000;

            this.moras.forEach((m, i) => {
                const x = padding + i * stepX;
                const d = Math.abs(x - mouseX);
                if (d < stepX / 2 && d < minD) {
                    minD = d;
                    closest = i;
                }
            });
            return closest;
        };

        this.canvas.addEventListener('mousedown', (e) => {
            const idx = getIndex(e);
            if (idx !== -1 && this.moras[idx].pitch > 0) {
                this.draggedIndex = idx;
                isDragging = true;
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging || this.draggedIndex === -1) return;
            const rect = this.canvas.getBoundingClientRect();
            const mouseY = e.clientY - rect.top;
            const h = this.canvas.height;
            const padding = 20;

            // Inverse getY approximates
            // y = h - padding - (norm * H)
            // norm = (h - padding - y) / H
            const H = h - padding * 2;
            let norm = (h - padding - mouseY) / H;

            // Map back to pitch
            // validPitches recalc needed? Assuming static range for drag session or dynamic?
            // Simple approach: Use same min/max as draw()
            const validPitches = this.moras.filter(m => m.pitch > 0).map(m => m.pitch);
            let minP = Math.min(...validPitches, 5.0) - 0.5;
            let maxP = Math.max(...validPitches, 6.5) + 0.5;

            let newPitch = minP + norm * (maxP - minP);
            newPitch = Math.max(minP, Math.min(maxP, newPitch)); // Clamp

            this.moras[this.draggedIndex].pitch = newPitch;
            this.draw();

            if (this.onPitchChange) this.onPitchChange();
        });

        window.addEventListener('mouseup', () => {
            isDragging = false;
            this.draggedIndex = -1;
        });
    }
}
