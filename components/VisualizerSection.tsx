
import React from 'react';
import Oscilloscope from './Oscilloscope';
import SpectrumAnalyzer from './SpectrumAnalyzer';
import DebugVuMeter from './DebugVuMeter';

// ============================================================================
// MAIN COMPONENT: VISUALIZER SECTION
// ============================================================================

interface VisualizerSectionProps {
    analyserNode: AnalyserNode | null;
    isModalOpen?: boolean;
}

const VisualizerSection: React.FC<VisualizerSectionProps> = React.memo(({ analyserNode, isModalOpen = false }) => {
    return (
        <div className="border border-zinc-400 p-4 _b-panel flex flex-col gap-4 relative overflow-hidden">
            <Oscilloscope analyser={analyserNode} isPaused={isModalOpen} />
            <SpectrumAnalyzer analyser={analyserNode} isPaused={isModalOpen} />
            {/* Hidden Service: Press '0' to toggle */}
            <DebugVuMeter analyser={analyserNode} isPaused={isModalOpen} />
        </div>
    );
});

export default VisualizerSection;
